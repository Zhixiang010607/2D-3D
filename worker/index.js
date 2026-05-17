const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 100000;
const DEFAULT_ADMIN_USERNAME = "yanyujie123";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse(null, 204);

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        return jsonResponse(await login(request, env));
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        const user = await requireUser(request, env);
        return jsonResponse({ user: publicUser(user) });
      }

      if (url.pathname === "/api/employees" && request.method === "GET") {
        await requireAdmin(request, env);
        const { results } = await env.DB.prepare(
          "SELECT id, username, active, created_at, updated_at FROM employees ORDER BY created_at DESC",
        ).all();
        return jsonResponse({ employees: results || [] });
      }

      if (url.pathname === "/api/employees" && request.method === "POST") {
        await requireAdmin(request, env);
        return jsonResponse(await createEmployee(request, env), 201);
      }

      const employeeMatch = url.pathname.match(/^\/api\/employees\/([^/]+)$/);
      if (employeeMatch && request.method === "PUT") {
        await requireAdmin(request, env);
        return jsonResponse(await updateEmployee(employeeMatch[1], request, env));
      }

      if (employeeMatch && request.method === "DELETE") {
        await requireAdmin(request, env);
        await env.DB.prepare("DELETE FROM employees WHERE id = ?").bind(employeeMatch[1]).run();
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (error) {
      return jsonResponse({ error: error.message || "Request failed" }, error.status || 500);
    }
  },
};

async function login(request, env) {
  const body = await readJson(request);
  const username = cleanUsername(body.username);
  const password = String(body.password || "");
  if (!username || !password) throw httpError("账号和密码不能为空", 400);

  const adminUsername = env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME;
  if (username === adminUsername && password === env.ADMIN_PASSWORD) {
    const user = { id: "admin", username: adminUsername, role: "admin" };
    return { token: await createToken(user, env), user: publicUser(user) };
  }

  const employee = await env.DB.prepare(
    "SELECT id, username, password_hash, password_salt, active FROM employees WHERE username = ?",
  )
    .bind(username)
    .first();
  if (!employee || !employee.active) throw httpError("账号或密码不正确", 401);

  const valid = await verifyPassword(password, employee.password_salt, employee.password_hash);
  if (!valid) throw httpError("账号或密码不正确", 401);

  const user = { id: employee.id, username: employee.username, role: "employee" };
  return { token: await createToken(user, env), user: publicUser(user) };
}

async function createEmployee(request, env) {
  const body = await readJson(request);
  const username = cleanUsername(body.username);
  const password = String(body.password || "").trim();
  validateEmployeeInput(username, password, env);

  const existing = await env.DB.prepare("SELECT id FROM employees WHERE username = ?").bind(username).first();
  if (existing) throw httpError("这个员工账号已经存在", 409);

  const passwordRecord = await hashPassword(password);
  const employee = {
    id: crypto.randomUUID(),
    username,
    active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await env.DB.prepare(
    "INSERT INTO employees (id, username, password_hash, password_salt, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
  )
    .bind(employee.id, employee.username, passwordRecord.hash, passwordRecord.salt, employee.created_at, employee.updated_at)
    .run();

  return { employee };
}

async function updateEmployee(id, request, env) {
  const body = await readJson(request);
  const username = cleanUsername(body.username);
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (!username) throw httpError("员工账号不能为空", 400);
  if (username === (env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME)) throw httpError("员工账号不能和管理员账号相同", 400);

  const current = await env.DB.prepare("SELECT id FROM employees WHERE id = ?").bind(id).first();
  if (!current) throw httpError("这个员工账号不存在", 404);

  const duplicate = await env.DB.prepare("SELECT id FROM employees WHERE username = ? AND id != ?").bind(username, id).first();
  if (duplicate) throw httpError("这个员工账号已经被其他员工使用", 409);

  const updatedAt = new Date().toISOString();
  if (password) {
    const passwordRecord = await hashPassword(password);
    await env.DB.prepare(
      "UPDATE employees SET username = ?, password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
    )
      .bind(username, passwordRecord.hash, passwordRecord.salt, updatedAt, id)
      .run();
  } else {
    await env.DB.prepare("UPDATE employees SET username = ?, updated_at = ? WHERE id = ?").bind(username, updatedAt, id).run();
  }

  const employee = await env.DB.prepare(
    "SELECT id, username, active, created_at, updated_at FROM employees WHERE id = ?",
  )
    .bind(id)
    .first();
  return { employee };
}

async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  if (user.role !== "admin") throw httpError("没有管理员权限", 403);
  return user;
}

async function requireUser(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw httpError("请先登录", 401);
  const payload = await verifyToken(token, env);
  if (!payload) throw httpError("登录已过期，请重新登录", 401);
  if (payload.role === "admin") return { id: "admin", username: payload.username, role: "admin" };

  const employee = await env.DB.prepare("SELECT id, username, active FROM employees WHERE id = ?").bind(payload.id).first();
  if (!employee || !employee.active) throw httpError("账号已失效，请联系管理员", 401);
  return { id: employee.id, username: employee.username, role: "employee" };
}

function validateEmployeeInput(username, password, env) {
  if (!username) throw httpError("员工账号不能为空", 400);
  if (!password) throw httpError("员工密码不能为空", 400);
  if (username === (env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME)) throw httpError("员工账号不能和管理员账号相同", 400);
}

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = base64UrlEncode(saltBytes);
  const hash = await derivePasswordHash(password, salt);
  return { salt, hash };
}

async function verifyPassword(password, salt, expectedHash) {
  const hash = await derivePasswordHash(password, salt);
  return safeEqual(hash, expectedHash);
}

async function derivePasswordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", textBytes(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlDecode(salt),
      iterations: PASSWORD_ITERATIONS,
    },
    key,
    256,
  );
  return base64UrlEncode(new Uint8Array(bits));
}

async function createToken(user, env) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE_SECONDS,
  };
  const encoded = base64UrlEncode(textBytes(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded, env)}`;
}

async function verifyToken(token, env) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const valid = await verifySignature(encoded, signature, env);
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function sign(value, env) {
  const key = await hmacKey(env);
  const signature = await crypto.subtle.sign("HMAC", key, textBytes(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifySignature(value, signature, env) {
  const key = await hmacKey(env);
  return crypto.subtle.verify("HMAC", key, base64UrlDecode(signature), textBytes(value));
}

async function hmacKey(env) {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 24) throw httpError("SESSION_SECRET 未配置或太短", 500);
  return crypto.subtle.importKey("raw", textBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw httpError("请求格式不正确", 400);
  }
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

function cleanUsername(value) {
  return String(value || "").trim();
}

function jsonResponse(body, status = 200) {
  return corsResponse(JSON.stringify(body), status, { "Content-Type": "application/json; charset=utf-8" });
}

function corsResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      ...headers,
    },
  });
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
