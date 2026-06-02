const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_FILES_PER_BATCH = 50;
const PREVIEW_MAX_SIZE = 1600;
const LIVE_PREVIEW_MAX_SIZE = 1200;
const LIVE_PREVIEW_DEBOUNCE_MS = 160;
const OUTPUT_JPEG_QUALITY = 0.98;
const RENDER_UI_UPDATE_INTERVAL = 6;
const RENDER_YIELD_INTERVAL = 4;
const DEFAULT_BADGE_RADIUS_PERCENT = 5.8;
const BADGE_SIZE_MIN = 40;
const BADGE_SIZE_MAX = 220;
const BADGE_OUTER_SCALE = 1.18;
const BADGE_SHADOW_BLUR_PERCENT = 1.8;
const BADGE_SHADOW_OFFSET_PERCENT = 0.8;
const AUTH_SESSION_KEY = "yyj-renderer-session-v1";
const AUTH_REMEMBER_KEY = "yyj-renderer-remember-login-v1";
const AUTH_API_BASE_URL = (window.YYJ_AUTH_API_URL || document.querySelector("meta[name='auth-api-base']")?.content || "").replace(/\/$/, "");
const ADMIN_USERNAME = "yanyujie123";
const state = {
  files: [],
  fileItems: [],
  productFileSequence: 0,
  userBackgrounds: [],
  activeBackgroundId: null,
  rendered: [],
  selectedRenderedIndex: -1,
  previewUrl: "",
  viewMode: "edit",
  processing: false,
  productShape: "",
  options: {
    backgroundFit: "cover",
    size: 3600,
    adjustOutputSize: false,
    depth: 7,
    edgeColor: "#8f9188",
    shadow: 42,
    shine: 48,
    lightAngle: -42,
    lightStrength: 64,
    reflection: 42,
    rimLight: 58,
    glare: 62,
    viewTilt: 24,
    spotlight: 0,
    spotlightX: 38,
    spotlightY: 34,
    spotlightWidth: 46,
    spotlightHeight: 46,
    spotlightRotation: 0,
    spotlightColor: "#ffffff",
    tilt: 0.06,
    material: "acrylic",
    badge: false,
    badgeX: 89.5,
    badgeY: 9.5,
    badgeSize: 100,
  },
};

let currentUser = null;
let livePreviewTimer = null;
let livePreviewRequestId = 0;

const imageContentRectCache = new WeakMap();

const productShapes = {
  circle: "圆形",
  ellipse: "椭圆",
  polygon: "正多边形",
  rectangle: "矩形",
};

const backgrounds = {
  white: { label: "纯白高级棚拍", css: "#ffffff", file: "#ffffff", stops: ["#ffffff", "#ffffff"] },
  porcelain: { label: "瓷白柔光", css: "linear-gradient(145deg, #ffffff 0%, #edf1ef 100%)", file: "#f7f8f6", stops: ["#ffffff", "#f8faf8", "#edf1ef"] },
  studio: { label: "浅灰摄影棚", css: "linear-gradient(145deg, #f8f8f6 0%, #ecefec 100%)", file: "#f4f4f2", stops: ["#fbfbfa", "#f3f4f1", "#e6e9e6"] },
  pearl: { label: "珍珠雾面", css: "linear-gradient(145deg, #fffefd 0%, #e8e5df 100%)", file: "#f5f2ec", stops: ["#fffefd", "#f5f1eb", "#e8e5df"] },
  cream: { label: "暖白展台", css: "linear-gradient(145deg, #fffaf0 0%, #efe6d7 100%)", file: "#fbf4e8", stops: ["#fffaf0", "#f8efe3", "#eadbc8"] },
  blush: { label: "樱粉奶油", css: "linear-gradient(145deg, #fff7f5 0%, #f2d8dc 100%)", file: "#faecee", stops: ["#fff9f7", "#faecee", "#f2d8dc"] },
  lavender: { label: "薰衣草雾紫", css: "linear-gradient(145deg, #fbf8ff 0%, #ddd8ee 100%)", file: "#eeeaf7", stops: ["#fbf8ff", "#eeeaf7", "#ddd8ee"] },
  mint: { label: "薄荷玻璃", css: "linear-gradient(145deg, #f6fffb 0%, #cfe7df 100%)", file: "#e7f5ef", stops: ["#f6fffb", "#e7f5ef", "#cfe7df"] },
  blue: { label: "冷调蓝灰", css: "linear-gradient(145deg, #f5f9fb 0%, #dce9ef 100%)", file: "#edf5f8", stops: ["#f7fbfd", "#edf5f8", "#d7e8ef"] },
  sky: { label: "晴空蓝白", css: "linear-gradient(145deg, #f6fbff 0%, #cfe3f3 100%)", file: "#e9f4fc", stops: ["#f6fbff", "#e9f4fc", "#cfe3f3"] },
  sage: { label: "鼠尾草绿", css: "linear-gradient(145deg, #fbfcf7 0%, #d7dfcf 100%)", file: "#edf2e6", stops: ["#fbfcf7", "#edf2e6", "#d7dfcf"] },
  butter: { label: "奶油黄", css: "linear-gradient(145deg, #fffdf2 0%, #f1df9d 100%)", file: "#fbf2ca", stops: ["#fffdf2", "#fbf2ca", "#f1df9d"] },
  peach: { label: "水蜜桃夕光", css: "linear-gradient(145deg, #fff7ee 0%, #f3c1a4 100%)", file: "#f9dfcf", stops: ["#fff7ee", "#f9dfcf", "#f3c1a4"] },
  graphite: { label: "深灰奢华", css: "linear-gradient(145deg, #4d524f 0%, #111514 100%)", file: "#252927", stops: ["#4d524f", "#252927", "#111514"], dark: true },
  midnight: { label: "午夜蓝展台", css: "linear-gradient(145deg, #334356 0%, #101825 100%)", file: "#172232", stops: ["#334356", "#172232", "#101825"], dark: true },
  transparent: { label: "透明 PNG", css: "checkerboard", file: "transparent", stops: ["transparent", "transparent"] },
};

const scenePresets = {
  none: "无图案",
  softGeometry: "柔和几何",
  editorialShapes: "杂志感色块",
  glassCards: "玻璃拟态层片",
  displayGrid: "摄影棚细网格",
  halo: "圆形光晕",
  auraRings: "渐隐同心环",
  waves: "丝带流线",
  silk: "丝绸弧光",
  sunburst: "柔焦放射光",
  diagonal: "斜切光影",
  checkerSoft: "淡雅棋盘",
  terrazzo: "水磨石碎片",
  confetti: "细碎彩纸",
  paper: "高级纸张纹理",
  topographic: "等高线纹理",
  boutique: "精品橱窗台",
};

const backgroundCombos = [
  ["white", "none"],
  ["image:neutral-materials-marble", "高级中性色材质板"],
  ["image:marble-fabric-swatches", "极简大理石布料板"],
  ["image:soft-paper-cards", "柔焦纸卡展台"],
  ["image:editorial-material-board", "杂志感材质拼贴"],
  ["image:orange-paper-curves", "橙色纸艺曲线"],
  ["image:light-blue-silk", "浅蓝丝绸"],
  ["image:crumpled-blue-silk", "清透蓝色绸缎"],
  ["image:brown-satin-ripples", "棕金缎面波纹"],
  ["image:monochrome-fabric-folds", "黑白柔光布褶"],
  ["transparent", "none"],
];

const downloadedBackgrounds = {
  "neutral-materials-marble": {
    label: "高级中性色材质板",
    src: "./assets/backgrounds/neutral-materials-marble.jpg",
    credit: "Pexels / Karola G",
  },
  "marble-fabric-swatches": {
    label: "极简大理石布料板",
    src: "./assets/backgrounds/marble-fabric-swatches.jpg",
    credit: "Pexels / Karola G",
  },
  "soft-paper-cards": {
    label: "柔焦纸卡展台",
    src: "./assets/backgrounds/soft-paper-cards.jpg",
    credit: "Pexels / Karola G",
  },
  "editorial-material-board": {
    label: "杂志感材质拼贴",
    src: "./assets/backgrounds/editorial-material-board.jpg",
    credit: "Pexels / Karola G",
  },
  "orange-paper-curves": {
    label: "橙色纸艺曲线",
    src: "./assets/backgrounds/orange-paper-curves.jpg",
    credit: "Pexels / Jakub Zerdzicki",
  },
  "light-blue-silk": {
    label: "浅蓝丝绸",
    src: "./assets/backgrounds/light-blue-silk.jpg",
    credit: "Pexels / Monstera Production",
  },
  "crumpled-blue-silk": {
    label: "清透蓝色绸缎",
    src: "./assets/backgrounds/crumpled-blue-silk.jpg",
    credit: "Pexels / Monstera Production",
  },
  "brown-satin-ripples": {
    label: "棕金缎面波纹",
    src: "./assets/backgrounds/brown-satin-ripples.jpg",
    credit: "Pexels / Anete Lusina",
  },
  "monochrome-fabric-folds": {
    label: "黑白柔光布褶",
    src: "./assets/backgrounds/monochrome-fabric-folds.jpg",
    credit: "Pexels / Mathias Reding",
  },
  "cream-pastel-swirl": {
    label: "奶油抽象旋涡",
    src: "./assets/backgrounds/cream-pastel-swirl.jpg",
    credit: "Pexels / Mahmoud Ramadan",
  },
  "white-silk-drapery": {
    label: "白色丝绸褶皱",
    src: "./assets/backgrounds/white-silk-drapery.jpg",
    credit: "Pexels / Seyda Nur Yuce",
  },
};

const app = document.querySelector("#app");

const appTemplate = `
  <main class="shell">
    <section class="hero">
      <div class="hero__copy">
        <p class="eyebrow">Batch Product Renderer</p>
        <h1>严宇杰老板专属小工具</h1>
        <p class="subcopy">上传本地产品图和背景后，按选定形状批量生成高清 3D 商品展示图，并一键打包下载 ZIP。</p>
      </div>
      <div class="hero__visual">
        <img src="./3d/661.jpeg" alt="3D product reference" />
      </div>
    </section>

    <section class="account-bar">
      <div class="account-title">
        <span>当前账号</span>
        <strong id="accountUserName">未登录</strong>
      </div>
      <div class="account-actions">
        <button id="adminToggle" class="secondary account-button" type="button" hidden>员工账号管理</button>
        <button id="logoutBtn" class="secondary account-button" type="button">退出登录</button>
      </div>
    </section>

    <section id="adminPanel" class="admin-panel field--hidden" aria-label="员工账号管理">
      <div class="admin-panel__head">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>员工账号管理</h2>
        </div>
        <p id="employeeAccountMessage" class="admin-message"></p>
      </div>
      <form id="employeeCreateForm" class="employee-form">
        <label>
          员工账号
          <input id="employeeUsername" type="text" autocomplete="off" placeholder="输入员工账号" />
        </label>
        <label>
          员工密码
          <input id="employeePassword" type="text" autocomplete="off" placeholder="输入员工密码" />
        </label>
        <button id="generateEmployeeCredentials" class="secondary account-button" type="button">随机生成</button>
        <button class="primary account-button" type="submit">新增员工</button>
      </form>
      <div id="employeeAccountList" class="employee-list"></div>
    </section>

    <section class="workbench">
      <aside class="panel">
        <div class="panel__title">
          <span data-icon="sliders"></span>
          <h2>上传设置</h2>
        </div>

        <div id="productUploadField" class="field">
          <label>产品图片</label>
          <div class="product-upload-actions">
            <label class="primary panel-file-button">
              <span data-icon="folder"></span>
              <input id="folderInput" type="file" accept="image/*" webkitdirectory multiple />
              上传文件夹
            </label>
            <label class="primary panel-file-button">
              <span data-icon="image"></span>
              <input id="productInput" type="file" accept="image/*" multiple />
              上传图片
            </label>
          </div>
          <p class="field-hint">直接上传图片每次最多 50 张；上传文件夹不限制数量，重复上传会追加保留。</p>
        </div>

        <div id="productShapeField" class="field field--disabled">
          <label for="productShape">图片形状</label>
          <select id="productShape" disabled>
            <option value="">选择图片形状</option>
            <option value="circle">圆形</option>
            <option value="ellipse">椭圆</option>
            <option value="polygon">正多边形</option>
            <option value="rectangle">矩形</option>
          </select>
        </div>

        <div id="backgroundUploadField" class="field">
          <label>背景库</label>
          <div class="background-actions">
            <label class="primary panel-file-button">
              <span data-icon="folder"></span>
              <input id="backgroundFolderUpload" type="file" accept="image/*" webkitdirectory multiple />
              上传文件夹
            </label>
            <label class="primary panel-file-button">
              <span data-icon="image"></span>
              <input id="backgroundUpload" type="file" accept="image/*" multiple />
              上传背景
            </label>
          </div>
          <p class="field-hint">直接上传背景每次最多 50 张；上传文件夹不限制数量。</p>
        </div>

        <div class="render-controls render-controls--left">
          <div class="panel__title">
            <span data-icon="sliders"></span>
            <h2>渲染参数</h2>
          </div>

          <div class="field">
            <label for="depth">边缘厚度 <b id="depthValue">7</b></label>
            <input id="depth" type="range" min="0" max="90" step="1" value="7" />
          </div>

          <div class="field">
            <label for="lightAngle">主光方向 <b id="lightAngleValue">-42</b>°</label>
            <input id="lightAngle" type="range" min="-180" max="180" step="1" value="-42" />
          </div>

          <div class="field">
            <label for="lightStrength">主光强度 <b id="lightStrengthValue">64</b>%</label>
            <input id="lightStrength" type="range" min="0" max="100" step="1" value="64" />
          </div>

          <div class="field">
            <label for="glare">强反光条 <b id="glareValue">62</b>%</label>
            <input id="glare" type="range" min="0" max="100" step="1" value="62" />
          </div>

          <div class="field">
            <label for="viewTilt">视角倾斜 <b id="viewTiltValue">24</b>%</label>
            <input id="viewTilt" type="range" min="0" max="100" step="1" value="24" />
          </div>

          <div class="field">
            <label for="spotlight">背景光斑 <b id="spotlightValue">0</b>%</label>
            <input id="spotlight" type="range" min="0" max="100" step="1" value="0" />
            <p class="field-hint">开启后在左侧预览图里拖动光斑，拉动边缘控制大小和压缩。</p>
          </div>

          <label class="toggle">
            <input id="badge" type="checkbox" />
            <span>添加可拖动 2D FLAT 标识</span>
          </label>

          <div class="field">
            <label for="badgeSize">标识大小 <b id="badgeSizeValue">100</b>%</label>
            <input id="badgeSize" type="range" min="40" max="220" step="5" value="100" />
          </div>
        </div>

      </aside>

      <section class="preview">
        <div class="preview__toolbar">
          <div>
            <p id="previewModeLabel" class="eyebrow">实时预览</p>
            <h2 id="statusTitle">等待上传图片</h2>
          </div>
          <span id="countPill" class="pill">0 张图片</span>
        </div>
        <div id="previewStage" class="stage">
          <div class="empty">
            <span data-icon="image"></span>
            <p>上传 2D 图片后，这里会显示第一张转换预览。</p>
          </div>
        </div>
      </section>

      <section class="queue">
        <div class="queue-section render-actions-panel">
          <div class="queue-section-header">
            <label>生成操作</label>
            <span data-icon="sparkles"></span>
          </div>
          <div class="render-action-buttons">
            <button id="renderBtn" class="primary action-button" disabled>
              <span data-icon="sparkles"></span>
              生成 3D 效果
            </button>
            <button id="clearRenderedBtn" class="primary action-button" disabled>
              <span data-icon="refresh"></span>
              清空 3D 效果
            </button>
            <button id="downloadBtn" class="primary action-button" disabled>
              <span data-icon="download"></span>
              下载 ZIP
            </button>
          </div>
          <label class="toggle output-size-toggle">
            <input id="adjustOutputSize" type="checkbox" />
            <span>调整输出尺寸</span>
          </label>
          <div id="outputSizeField" class="field field--hidden">
            <label for="size">输出尺寸 <b id="sizeValue">3600</b> × <b id="sizeValueY">3600</b> px</label>
            <input id="size" type="range" min="800" max="8000" step="200" value="3600" />
          </div>
        </div>

        <div class="queue-section product-files-field">
          <div class="queue-section-header">
            <label>上传图片列表</label>
            <span id="productFileCount" class="mini-count">0 / 0</span>
          </div>
          <div class="product-file-actions">
            <button id="selectAllProducts" class="mini-button" type="button" disabled>全选</button>
            <button id="deselectAllProducts" class="mini-button" type="button" disabled>全部不勾选</button>
            <button id="clearProductFiles" class="mini-button mini-button--danger" type="button" disabled>清空上传图片</button>
          </div>
          <div id="productFileList" class="product-file-list"></div>
        </div>

        <div class="queue-section background-library-field">
          <div class="queue-section-header">
            <label>背景库图片</label>
          </div>
          <div id="backgroundLibrary" class="background-library"></div>
        </div>

        <div class="queue-section generated-files-field">
          <div class="queue-section-header">
            <label>生成图列表</label>
          </div>
          <div id="fileList" class="file-list"></div>
        </div>
      </section>
    </section>
  </main>
`;

async function bootstrap() {
  currentUser = await readSessionUser();
  if (currentUser) {
    renderAppShell();
    return;
  }
  renderLoginScreen();
}

function renderLoginScreen(message = "") {
  currentUser = null;
  const rememberedLogin = readRememberedLogin();
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card">
        <p class="eyebrow">Account Login</p>
        <h1>严宇杰老板专属小工具</h1>
        <p class="subcopy">请先登录账号，登录后才能使用批量 3D 商品图生成工具。</p>
        <form id="loginForm" class="auth-form">
          <label>
            账号
            <input id="loginUsername" type="text" autocomplete="username" value="${escapeHtml(rememberedLogin?.username || "")}" required />
          </label>
          <label>
            密码
            <input id="loginPassword" type="password" autocomplete="current-password" value="${escapeHtml(rememberedLogin?.password || "")}" required />
          </label>
          <label class="auth-remember">
            <input id="rememberPassword" type="checkbox" ${rememberedLogin ? "checked" : ""} />
            <span>记住密码</span>
          </label>
          <button class="primary auth-submit" type="submit">登录使用</button>
          <p id="authMessage" class="auth-message">${escapeHtml(message)}</p>
        </form>
      </section>
    </main>
  `;
  bindLoginEvents();
}

function renderAppShell() {
  app.innerHTML = appTemplate;
  renderIcons();
  fillBackgrounds();
  bindEvents();
  bindAuthEvents();
  renderAccountUi();
  updateUi();
}

function readRememberedLogin() {
  try {
    const remembered = JSON.parse(window.localStorage.getItem(AUTH_REMEMBER_KEY) || "null");
    if (!remembered || typeof remembered.username !== "string" || typeof remembered.password !== "string") return null;
    return {
      username: remembered.username,
      password: remembered.password,
    };
  } catch {
    window.localStorage.removeItem(AUTH_REMEMBER_KEY);
    return null;
  }
}

function saveRememberedLogin(username, password) {
  window.localStorage.setItem(AUTH_REMEMBER_KEY, JSON.stringify({ username, password }));
}

function clearRememberedLogin() {
  window.localStorage.removeItem(AUTH_REMEMBER_KEY);
}

async function readSessionUser() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(AUTH_SESSION_KEY) || "null");
    if (!session?.token) return null;
    const data = await authApiRequest("/api/auth/me", { auth: false, token: session.token });
    return { ...data.user, token: session.token };
  } catch {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

function writeSessionUser(user) {
  window.sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token: user.token }));
}

async function authenticate(username, password) {
  const data = await authApiRequest("/api/auth/login", {
    auth: false,
    method: "POST",
    body: { username, password },
  });
  return { ...data.user, token: data.token };
}

function authApiUrl(path) {
  return `${AUTH_API_BASE_URL}${path}`;
}

function readStoredToken() {
  try {
    return JSON.parse(window.sessionStorage.getItem(AUTH_SESSION_KEY) || "null")?.token || "";
  } catch {
    return "";
  }
}

async function authApiRequest(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const token = options.token || (options.auth === false ? "" : currentUser?.token || readStoredToken());
  if (token) headers.Authorization = `Bearer ${token}`;
  const requestOptions = {
    method: options.method || "GET",
    headers,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(authApiUrl(path), requestOptions);
  } catch {
    throw new Error("云端账号 API 连接失败，请检查 Worker 地址是否配置正确");
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("云端账号 API 返回异常，请检查 Worker 是否部署成功");
  }
  if (!response.ok) throw new Error(data.error || "云端账号请求失败");
  return data;
}

function bindLoginEvents() {
  document.querySelector("#loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.querySelector("#loginUsername").value.trim();
    const password = document.querySelector("#loginPassword").value;
    const rememberPassword = document.querySelector("#rememberPassword")?.checked;
    const button = event.currentTarget.querySelector("button[type='submit']");
    const message = document.querySelector("#authMessage");
    button.disabled = true;
    message.textContent = "正在登录...";
    try {
      const user = await authenticate(username, password);
      if (rememberPassword) {
        saveRememberedLogin(username, password);
      } else {
        clearRememberedLogin();
      }
      currentUser = user;
      writeSessionUser(user);
      renderAppShell();
    } catch (error) {
      message.textContent = error.message || "账号或密码不正确";
      button.disabled = false;
    }
  });
}

function bindAuthEvents() {
  document.querySelector("#logoutBtn")?.addEventListener("click", () => {
    window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    resetWorkspaceState();
    renderLoginScreen("已退出登录");
  });

  document.querySelector("#adminToggle")?.addEventListener("click", () => {
    const panel = document.querySelector("#adminPanel");
    if (!panel) return;
    panel.classList.toggle("field--hidden");
    renderEmployeeAccountList();
  });

  document.querySelector("#generateEmployeeCredentials")?.addEventListener("click", () => {
    document.querySelector("#employeeUsername").value = createSuggestedUsername();
    document.querySelector("#employeePassword").value = createSuggestedPassword();
    setEmployeeMessage("已随机生成账号和密码，可以直接新增或手动修改");
  });

  document.querySelector("#employeeCreateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const usernameInput = document.querySelector("#employeeUsername");
    const passwordInput = document.querySelector("#employeePassword");
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const validation = validateEmployeeAccount(username, password);
    if (validation) {
      setEmployeeMessage(validation);
      return;
    }
    setEmployeeMessage("正在新增员工账号...");
    try {
      await authApiRequest("/api/employees", {
        method: "POST",
        body: { username, password },
      });
      usernameInput.value = "";
      passwordInput.value = "";
      await renderEmployeeAccountList("已新增员工账号");
    } catch (error) {
      setEmployeeMessage(error.message || "新增员工账号失败");
    }
  });

  document.querySelector("#employeeAccountList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-employee-action]");
    if (!button) return;
    const row = button.closest("[data-employee-id]");
    if (!row) return;
    const id = row.dataset.employeeId;
    const action = button.dataset.employeeAction;
    if (action === "save") {
      saveEmployeeAccountFromRow(row, id, button);
      return;
    }
    if (action === "delete") {
      deleteEmployeeAccount(id, button);
    }
  });
}

function renderAccountUi() {
  const label = document.querySelector("#accountUserName");
  const adminToggle = document.querySelector("#adminToggle");
  if (label) label.textContent = currentUser?.role === "admin" ? `管理员：${currentUser.username}` : `员工：${currentUser?.username || ""}`;
  if (adminToggle) adminToggle.hidden = currentUser?.role !== "admin";
  renderEmployeeAccountList();
}

async function renderEmployeeAccountList(message = "") {
  const list = document.querySelector("#employeeAccountList");
  if (!list) return;
  if (currentUser?.role !== "admin") {
    list.innerHTML = "";
    return;
  }
  list.innerHTML = `<p class="muted">正在读取员工账号...</p>`;
  let accounts = [];
  try {
    const data = await authApiRequest("/api/employees");
    accounts = data.employees || [];
  } catch (error) {
    list.innerHTML = `<p class="muted">${escapeHtml(error.message || "无法读取员工账号")}</p>`;
    setEmployeeMessage("无法读取员工账号");
    return;
  }
  if (!accounts.length) {
    list.innerHTML = `<p class="muted">还没有员工账号。可以手动输入，也可以点击随机生成。</p>`;
    setEmployeeMessage(message);
    return;
  }
  list.innerHTML = accounts
    .map(
      (account, index) => `
        <div class="employee-row" data-employee-id="${escapeHtml(account.id)}">
          <span class="employee-index">${index + 1}</span>
          <label>
            账号
            <input class="employee-row-username" type="text" value="${escapeHtml(account.username)}" autocomplete="off" />
          </label>
          <label>
            新密码
            <input class="employee-row-password" type="text" value="" autocomplete="off" placeholder="留空则不修改密码" />
          </label>
          <button class="secondary account-button" type="button" data-employee-action="save">保存</button>
          <button class="secondary account-button account-button--danger" type="button" data-employee-action="delete">删除</button>
        </div>
      `,
    )
    .join("");
  setEmployeeMessage(message);
}

async function saveEmployeeAccountFromRow(row, id, button) {
  const username = row.querySelector(".employee-row-username").value.trim();
  const password = row.querySelector(".employee-row-password").value.trim();
  const validation = validateEmployeeAccount(username, password, { passwordRequired: false });
  if (validation) {
    setEmployeeMessage(validation);
    return;
  }
  button.disabled = true;
  setEmployeeMessage("正在保存员工账号...");
  try {
    await authApiRequest(`/api/employees/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: password ? { username, password } : { username },
    });
    await renderEmployeeAccountList("员工账号已更新");
  } catch (error) {
    setEmployeeMessage(error.message || "员工账号更新失败");
    button.disabled = false;
  }
}

async function deleteEmployeeAccount(id, button) {
  button.disabled = true;
  setEmployeeMessage("正在删除员工账号...");
  try {
    await authApiRequest(`/api/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
    await renderEmployeeAccountList("员工账号已删除");
  } catch (error) {
    setEmployeeMessage(error.message || "员工账号删除失败");
    button.disabled = false;
  }
}

function validateEmployeeAccount(username, password, options = { passwordRequired: true }) {
  if (!username) return "员工账号不能为空";
  if (options.passwordRequired && !password) return "员工密码不能为空";
  if (username === ADMIN_USERNAME) return "员工账号不能和管理员账号相同";
  return "";
}

function setEmployeeMessage(message) {
  const node = document.querySelector("#employeeAccountMessage");
  if (node) node.textContent = message || "";
}

function createSuggestedUsername() {
  const suffix = String(Date.now()).slice(-6);
  return `staff${suffix}`;
}

function createSuggestedPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let index = 0; index < 10; index += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

function resetWorkspaceState() {
  clearRendered();
  revokeProductFileUrls();
  state.fileItems = [];
  state.files = [];
  state.productShape = "";
  state.userBackgrounds.forEach((background) => {
    if (background.url) URL.revokeObjectURL(background.url);
    releaseDecodedImage(background.image);
  });
  state.userBackgrounds = [];
  state.activeBackgroundId = null;
  revokePreview();
}

function renderIcons() {
  const map = {
    archive: iconArchive,
    check: iconCheck,
    download: iconDownload,
    folder: iconFolder,
    image: iconImage,
    loader: iconLoader,
    palette: iconPalette,
    refresh: iconRefresh,
    sliders: iconSliders,
    sparkles: iconSparkles,
  };

  document.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = map[node.dataset.icon] || "";
  });
}

function fillBackgrounds() {
  paintBackgroundLibrary();
}

function bindEvents() {
  document.querySelector("#productInput").addEventListener("change", handleProductFiles);
  document.querySelector("#folderInput").addEventListener("change", handleProductFiles);
  document.querySelector("#renderBtn").addEventListener("click", renderAll);
  document.querySelector("#downloadBtn").addEventListener("click", downloadZip);
  document.querySelector("#clearRenderedBtn").addEventListener("click", clearRenderedResults);
  document.querySelector("#selectAllProducts").addEventListener("click", () => setAllProductFilesSelected(true));
  document.querySelector("#deselectAllProducts").addEventListener("click", () => setAllProductFilesSelected(false));
  document.querySelector("#clearProductFiles").addEventListener("click", clearProductFiles);
  document.querySelector("#backgroundUpload").addEventListener("change", handleBackgroundFiles);
  document.querySelector("#backgroundFolderUpload").addEventListener("change", handleBackgroundFiles);
  document.querySelector("#productShape").addEventListener("change", handleProductShape);

  ["size", "depth", "lightAngle", "lightStrength", "glare", "viewTilt", "spotlight", "badgeSize"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      const value = event.target.type === "range" ? Number(event.target.value) : event.target.value;
      state.options[id] = value;
      normalizeBadgePosition();
      clearRendered();
      syncOptionLabels();
      updateUi("设置已更新，已用第一张产品图和第一个背景刷新预览");
      renderPreview({ forceProductPreview: true });
    });
  });

  document.querySelector("#badge").addEventListener("change", (event) => {
    state.options.badge = event.target.checked;
    clearRendered();
    updateUi(event.target.checked ? "2D FLAT 标识已开启，已刷新示例预览" : "2D FLAT 标识已关闭，已刷新示例预览");
    renderPreview({ forceProductPreview: true });
  });

  document.querySelector("#adjustOutputSize").addEventListener("change", (event) => {
    state.options.adjustOutputSize = event.target.checked;
    syncOutputSizeControl();
    updateUi(event.target.checked ? "输出尺寸调整已展开" : "输出尺寸调整已收起，默认保持 3600 × 3600");
  });
}

function handleProductShape(event) {
  const nextShape = event.target.value;
  state.productShape = productShapes[nextShape] ? nextShape : "";
  if (state.productShape) {
    applyProductShapeToLayouts(state.productShape);
  }
  clearRendered();
  updateUi(state.productShape ? `图片形状已设为${productShapes[state.productShape]}，可以继续设置背景` : "请选择图片形状");
  renderPreview();
}

function handleProductFiles(event) {
  let files = Array.from(event.target.files)
    .filter((file) => IMAGE_TYPES.has(file.type))
    .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
  const isDirectImageUpload = event.target.id === "productInput";
  const imageCount = files.length;
  const limited = isDirectImageUpload && imageCount > MAX_UPLOAD_FILES_PER_BATCH;
  if (limited) files = files.slice(0, MAX_UPLOAD_FILES_PER_BATCH);
  event.target.value = "";
  if (!files.length) return;
  clearRendered();
  state.fileItems.push(...files.map((file) => createProductFileItem(file)));
  syncProductFiles();
  revokePreview();
  const addMessage = limited
    ? `一次最多上传 ${MAX_UPLOAD_FILES_PER_BATCH} 张，已追加前 ${files.length} 张`
    : `已追加 ${files.length} 张图片`;
  updateUi(
    hasSelectedProductShape()
      ? `${addMessage}，当前共 ${state.fileItems.length} 张`
      : `${addMessage}，请选择图片形状`,
  );
  renderPreview();
}

function createProductFileItem(file) {
  state.productFileSequence += 1;
  return {
    id: `product-${Date.now()}-${state.productFileSequence}`,
    file,
    selected: true,
    url: URL.createObjectURL(file),
  };
}

function syncProductFiles() {
  state.files = state.fileItems.map((item) => item.file);
}

function getSelectedProductItems() {
  return state.fileItems.filter((item) => item.selected);
}

function setAllProductFilesSelected(selected) {
  if (!state.fileItems.length || isWaitingForProductShape()) return;
  state.fileItems.forEach((item) => {
    item.selected = selected;
  });
  clearRendered();
  updateUi(selected ? "已勾选全部上传图片" : "已取消全部上传图片");
  renderPreview();
}

function clearProductFiles() {
  if (isWaitingForProductShape()) return;
  if (!state.fileItems.length) return;
  clearRendered();
  revokeProductFileUrls();
  state.files = [];
  state.fileItems = [];
  state.productShape = "";
  document.querySelector("#productInput").value = "";
  document.querySelector("#folderInput").value = "";
  revokePreview();
  updateUi("已清空上传图片");
  renderPreview();
}

function removeProductFile(id) {
  if (state.processing || isWaitingForProductShape()) return;
  const index = state.fileItems.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = state.fileItems.splice(index, 1);
  if (item.url) URL.revokeObjectURL(item.url);
  syncProductFiles();
  if (!state.fileItems.length) {
    state.productShape = "";
    document.querySelector("#productInput").value = "";
    document.querySelector("#folderInput").value = "";
  }
  clearRendered();
  revokePreview();
  updateUi("已删除这张上传图片");
  renderPreview();
}

function revokeProductFileUrls() {
  state.fileItems.forEach((item) => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
}

async function handleBackgroundFiles(event) {
  if (!hasProductFiles() || isWaitingForProductShape()) {
    event.target.value = "";
    updateUi(hasProductFiles() ? "请先选择图片形状" : "请先上传产品图片");
    renderPreview();
    return;
  }
  let files = Array.from(event.target.files).filter((file) => IMAGE_TYPES.has(file.type));
  const isDirectImageUpload = event.target.id === "backgroundUpload";
  const imageCount = files.length;
  const limited = isDirectImageUpload && imageCount > MAX_UPLOAD_FILES_PER_BATCH;
  if (limited) files = files.slice(0, MAX_UPLOAD_FILES_PER_BATCH);
  if (!files.length) return;
  const hadBackgrounds = state.userBackgrounds.length > 0;
  clearRendered();
  for (const file of files) {
    const image = await loadImage(file);
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    state.userBackgrounds.push({
      id,
      file,
      image,
      url: URL.createObjectURL(file),
      name: file.name.replace(/\.[^.]+$/, ""),
      selected: true,
      layoutMode: "free",
      freeLayout: createDefaultPlacement(getSelectedProductShape() || "circle"),
    });
    if (!state.activeBackgroundId) state.activeBackgroundId = id;
  }
  if (!hadBackgrounds) {
    state.options.depth = 0;
    const depthInput = document.querySelector("#depth");
    if (depthInput) depthInput.value = "0";
    syncOptionLabels();
  }
  event.target.value = "";
  paintBackgroundLibrary();
  updateUi(limited ? `一次最多上传 ${MAX_UPLOAD_FILES_PER_BATCH} 张背景图，已载入前 ${files.length} 张` : `已载入 ${files.length} 张背景图`);
  renderPreview();
}

async function renderPreview({ forceProductPreview = false } = {}) {
  if (state.processing) return;
  state.viewMode = "edit";
  if (state.files.length && !hasSelectedProductShape()) {
    paintShapeRequiredStage();
    return;
  }
  const selectedItems = getSelectedProductItems();
  const previewProductItem = forceProductPreview ? state.fileItems[0] || selectedItems[0] : selectedItems[0];
  if (state.files.length && !selectedItems.length && !forceProductPreview) {
    paintNoSelectedProductsStage();
    return;
  }
  const focusedBackground = getFocusedBackground();
  if (focusedBackground) {
    paintPlacementStage(focusedBackground);
    return;
  }
  const previewBackground = forceProductPreview ? state.userBackgrounds[0] || getActiveBackgroundPresets()[0] : focusedBackground?.selected ? focusedBackground : getActiveBackgroundPresets()[0];
  if (!previewProductItem || !previewBackground) {
    paintEmptyStage();
    return;
  }
  const previewOptions = { ...state.options, size: Math.min(state.options.size, PREVIEW_MAX_SIZE), badge: false };
  const blob = await renderProduct(previewProductItem.file, previewOptions, previewBackground);
  revokePreview();
  state.previewUrl = URL.createObjectURL(blob);
  paintPreview(state.previewUrl, { interactiveBadge: state.options.badge });
}

function scheduleLivePreview() {
  if (livePreviewTimer) {
    clearTimeout(livePreviewTimer);
    livePreviewTimer = null;
  }
  livePreviewRequestId += 1;
  clearPlacementLivePreview();
  setLivePreviewLoading(false);
}

async function renderLivePreview({ forceProductPreview = false, requestId = ++livePreviewRequestId } = {}) {
  if (state.processing || state.viewMode !== "edit" || !hasSelectedProductShape()) {
    if (requestId === livePreviewRequestId) setLivePreviewLoading(false);
    return;
  }
  const selectedItems = getSelectedProductItems();
  const productItem = forceProductPreview ? state.fileItems[0] || selectedItems[0] : selectedItems[0] || state.fileItems[0];
  const backgroundItem = getFocusedBackground();
  if (!productItem || !backgroundItem) {
    if (requestId === livePreviewRequestId) setLivePreviewLoading(false);
    return;
  }

  try {
    const previewOptions = {
      ...state.options,
      size: Math.min(state.options.size, LIVE_PREVIEW_MAX_SIZE),
      badge: false,
    };
    const blob = await renderProduct(productItem.file, previewOptions, backgroundItem);
    if (requestId !== livePreviewRequestId || state.processing || state.viewMode !== "edit") return;
    const previousPreviewUrl = state.previewUrl;
    state.previewUrl = URL.createObjectURL(blob);
    if (previousPreviewUrl) URL.revokeObjectURL(previousPreviewUrl);
    setLivePreviewImage(state.previewUrl);
  } catch (error) {
    console.error(error);
    if (requestId === livePreviewRequestId) {
      const fallbackUrl = getLivePreviewUrl(backgroundItem, productItem);
      if (fallbackUrl) setLivePreviewImage(fallbackUrl);
      updateUi("实时预览生成失败，请检查当前图片或参数");
    }
  } finally {
    if (requestId === livePreviewRequestId) setLivePreviewLoading(false);
  }
}

function setLivePreviewImage(url) {
  if (state.viewMode !== "edit") return;
  const canvas = document.querySelector(".placement-canvas");
  if (!canvas || !url) return;
  let image = canvas.querySelector(".placement-live-preview");
  if (!image) {
    image = document.createElement("img");
    image.className = "placement-live-preview";
    image.alt = "Live 3D preview";
    image.draggable = false;
    canvas.prepend(image);
  }
  image.src = url;
  canvas.classList.add("placement-canvas--live");
}

function clearPlacementLivePreview() {
  const canvas = document.querySelector(".placement-canvas");
  if (!canvas) return;
  canvas.querySelector(".placement-live-preview")?.remove();
  canvas.classList.remove("placement-canvas--live", "placement-canvas--loading");
}

function getLivePreviewUrl(backgroundItem, productItem) {
  if (state.previewUrl) return state.previewUrl;
  const exactRendered = state.rendered.find((item) => {
    const sameBackground = !backgroundItem || item.backgroundItem?.id === backgroundItem.id;
    const sameProduct = !productItem || item.file === productItem.file;
    return sameBackground && sameProduct;
  });
  return exactRendered?.url || state.rendered[state.selectedRenderedIndex]?.url || state.rendered[0]?.url || "";
}

function setLivePreviewLoading(loading) {
  document.querySelector(".placement-canvas")?.classList.toggle("placement-canvas--loading", loading);
}

function placementBackgroundMarkup(backgroundItem, fit) {
  if (fit === "blurCover") {
    return `<img class="placement-bg placement-bg--blur" src="${backgroundItem.url}" alt="" draggable="false" />
            <img class="placement-bg placement-bg--contain" src="${backgroundItem.url}" alt="${escapeHtml(backgroundItem.name)}" draggable="false" />`;
  }
  return `<img class="placement-bg placement-bg--${fit === "contain" ? "contain" : "cover"}" src="${backgroundItem.url}" alt="${escapeHtml(backgroundItem.name)}" draggable="false" />`;
}

async function renderAll() {
  const selectedItems = getSelectedProductItems();
  if (!selectedItems.length || !hasSelectedProductShape()) return;
  state.processing = true;
  clearRendered();
  updateUi("正在生成 3D 效果图...");
  const activeBackgrounds = getActiveBackgroundPresets();
  const total = selectedItems.length * activeBackgrounds.length;
  const renderOptions = { ...state.options };
  const renderCanvas = document.createElement("canvas");
  let done = 0;

  try {
    for (const fileItem of selectedItems) {
      const file = fileItem.file;
      const source = await loadImage(file);
      try {
        for (const backgroundItem of activeBackgrounds) {
          const blob = await renderProductFromSource(source, renderOptions, backgroundItem, renderCanvas);
          const renderedItem = {
            file,
            blob,
            backgroundItem,
            backgroundLabel: backgroundItem.name,
            name: outputName(file, backgroundItem),
            url: URL.createObjectURL(blob),
          };
          state.rendered.push(renderedItem);
          done += 1;
          if (done === total || done % RENDER_UI_UPDATE_INTERVAL === 0) updateProgress(done, total);
          if (done % RENDER_YIELD_INTERVAL === 0) await nextFrame();
        }
      } finally {
        releaseDecodedImage(source);
      }
    }
  } catch (error) {
    console.error(error);
    releaseCanvas(renderCanvas);
    state.processing = false;
    updateUi("生成失败，请减少单次数量或输出尺寸后重试");
    return;
  }

  if (done) updateProgress(done, total);
  releaseCanvas(renderCanvas);
  state.processing = false;
  state.selectedRenderedIndex = state.rendered.length ? 0 : -1;
  updateUi("已生成，准备打包下载");
  if (state.rendered.length) {
    showRenderedResult(0, "已生成，点击右侧生成图列表可以切换查看");
  } else {
    renderPreview();
  }
}

async function downloadZip() {
  const validation = validateRenderedForDownload();
  if (!validation.ready) {
    updateUi(validation.message);
    return;
  }
  state.processing = true;
  updateUi("正在打包 ZIP...");
  try {
    const content = await makeZipFromRendered(validation.items, (done, total) => {
      if (done === total || done % 20 === 0) {
        document.querySelector("#statusTitle").textContent = `正在打包 ZIP ${done} / ${total}`;
      }
    });
    const url = URL.createObjectURL(content);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `3d-rendered-products-${new Date().toISOString().slice(0, 10)}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    state.processing = false;
    updateUi("ZIP 已生成");
  } catch (error) {
    console.error(error);
    state.processing = false;
    updateUi("ZIP 打包失败，请减少单次数量后重试");
  }
}

async function makeZipFromRendered(items, onProgress = () => {}) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const bytes = new Uint8Array(await item.blob.arrayBuffer());
    const nameBytes = encoder.encode(`3d-rendered-products/${item.name}`);
    const crc = crc32(bytes);
    const localHeader = concatBytes(
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(bytes.length),
      u32(bytes.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    );
    parts.push(localHeader, bytes);

    central.push(
      concatBytes(
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(bytes.length),
        u32(bytes.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ),
    );
    offset += localHeader.length + bytes.length;
    onProgress(index + 1, items.length);
    if ((index + 1) % 20 === 0) await nextFrame();
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = concatBytes(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(items.length),
    u16(items.length),
    u32(centralSize),
    u32(offset),
    u16(0),
  );
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function concatBytes(...chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let cursor = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, cursor);
    cursor += chunk.length;
  });
  return result;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function clearRendered() {
  state.rendered.forEach((item) => {
    if (item.url) URL.revokeObjectURL(item.url);
  });
  state.rendered = [];
  state.selectedRenderedIndex = -1;
  state.viewMode = "edit";
}

function clearRenderedResults() {
  if (state.processing) return;
  clearRendered();
  revokePreview();
  updateUi("已清空 3D 效果，可以继续调整占位");
  paintClearedPreviewStage();
}

function paintClearedPreviewStage() {
  state.viewMode = "edit";
  if (state.files.length && !hasSelectedProductShape()) {
    paintShapeRequiredStage();
    return;
  }
  if (state.files.length && !getSelectedProductItems().length) {
    paintNoSelectedProductsStage();
    return;
  }
  const focusedBackground = getFocusedBackground();
  if (focusedBackground && hasSelectedProductShape()) {
    paintPlacementStage(focusedBackground);
    return;
  }
  paintEmptyStage();
}

function getActiveBackgroundPresets() {
  return state.userBackgrounds.filter((background) => background.selected);
}

function getExpectedRenderPlan() {
  const selectedItems = getSelectedProductItems();
  const activeBackgrounds = getActiveBackgroundPresets();
  return {
    selectedItems,
    activeBackgrounds,
    total: selectedItems.length * activeBackgrounds.length,
  };
}

function getRenderedItemsForCurrentPlan() {
  const { selectedItems, activeBackgrounds } = getExpectedRenderPlan();
  const items = [];
  for (const fileItem of selectedItems) {
    for (const backgroundItem of activeBackgrounds) {
      const renderedItem = state.rendered.find((item) => item.file === fileItem.file && item.backgroundItem?.id === backgroundItem.id);
      if (renderedItem) items.push(renderedItem);
    }
  }
  return items;
}

function validateRenderedForDownload() {
  const { selectedItems, activeBackgrounds, total } = getExpectedRenderPlan();
  if (!selectedItems.length) {
    return { ready: false, items: [], message: "请先勾选至少一张产品图片，再生成 3D 效果" };
  }
  if (!hasSelectedProductShape()) {
    return { ready: false, items: [], message: "请先选择图片形状，再生成 3D 效果" };
  }
  if (!activeBackgrounds.length) {
    return { ready: false, items: [], message: "请先勾选至少一个背景，再生成 3D 效果" };
  }
  const items = getRenderedItemsForCurrentPlan();
  if (items.length !== total) {
    return {
      ready: false,
      items,
      message: `当前只生成了 ${items.length} / ${total} 张批量 3D 成品。中间实时预览不算 ZIP 成品，请先点击生成 3D 效果`,
    };
  }
  return { ready: true, items, message: "" };
}

function getFocusedBackground() {
  return state.userBackgrounds.find((background) => background.id === state.activeBackgroundId) || getActiveBackgroundPresets()[0] || state.userBackgrounds[0];
}

function setFocusedBackground(id) {
  state.activeBackgroundId = id;
}

function getBackgroundLayoutMode(backgroundItem) {
  if (backgroundItem) backgroundItem.layoutMode = "free";
  return "free";
}

function getSelectedProductShape() {
  return productShapes[state.productShape] ? state.productShape : "";
}

function getSelectedProductShapeLabel() {
  return productShapes[getSelectedProductShape()] || "未选择";
}

function hasSelectedProductShape() {
  return Boolean(getSelectedProductShape());
}

function hasProductFiles() {
  return state.fileItems.length > 0;
}

function isWaitingForProductShape() {
  return hasProductFiles() && !hasSelectedProductShape();
}

function applyProductShapeToLayouts(shape) {
  state.userBackgrounds.forEach((background) => {
    background.freeLayout = convertPlacementShape(background.freeLayout, shape);
  });
}

function placementLayoutForBackground(backgroundItem) {
  const shape = getSelectedProductShape() || backgroundItem?.freeLayout?.shape || "circle";
  return normalizePlacementLayout({ ...(backgroundItem?.freeLayout || {}), shape });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function readBoundedNumberInput(input, { integer = false } = {}) {
  const raw = input.value.trim();
  const min = Number(input.min);
  const max = Number(input.max);
  const isIncomplete = raw === "" || raw === "-" || raw === "+" || raw === "." || raw === "-." || raw === "+.";
  if (isIncomplete) {
    input.classList.remove("number-control--invalid");
    input.setCustomValidity("");
    return null;
  }
  const value = Number(raw);
  const valid = Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
  input.classList.toggle("number-control--invalid", !valid);
  input.setCustomValidity(valid ? "" : `请输入 ${min} 到 ${max} 范围内的${integer ? "整数" : "数字"}`);
  return valid ? value : null;
}

function clearNumberInputState(...inputs) {
  inputs.forEach((input) => {
    input?.classList.remove("number-control--invalid");
    input?.setCustomValidity("");
  });
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function badgeSizeScale(options = state.options) {
  return clamp(numberOr(options.badgeSize, 100), BADGE_SIZE_MIN, BADGE_SIZE_MAX) / 100;
}

function badgeRadiusPercent(options = state.options) {
  return DEFAULT_BADGE_RADIUS_PERCENT * badgeSizeScale(options);
}

function badgeOuterRadiusPercent(options = state.options) {
  return badgeRadiusPercent(options) * BADGE_OUTER_SCALE;
}

function badgeMarkerRadiusPercent(options = state.options) {
  return (
    badgeOuterRadiusPercent(options) +
    BADGE_SHADOW_BLUR_PERCENT * badgeSizeScale(options) +
    BADGE_SHADOW_OFFSET_PERCENT * badgeSizeScale(options)
  );
}

function badgeMarkerSizePercent(options = state.options) {
  return badgeMarkerRadiusPercent(options) * 2;
}

function badgePositionBounds(options = state.options) {
  const min = Math.min(50, badgeOuterRadiusPercent(options));
  return { min, max: 100 - min };
}

function normalizeBadgePosition(options = state.options) {
  const { min, max } = badgePositionBounds(options);
  options.badgeX = clamp(numberOr(options.badgeX, 89.5), min, max);
  options.badgeY = clamp(numberOr(options.badgeY, 9.5), min, max);
}

function createDefaultPlacement(shape = "circle") {
  return {
    x: 50,
    y: 50,
    shape: productShapes[shape] ? shape : "circle",
    radius: 50,
    circleWidth: 100,
    circleHeight: 100,
    roundScale: 100,
    stretchX: 100,
    stretchY: 100,
    sideLength: 50,
    sides: 6,
    rectLength: 120,
    rectWidth: 80,
    longAxis: 120,
    shortAxis: 80,
    fixedScale: 100,
    rotation: 0,
    fineTune: false,
    tuneLineColor: "black",
    quadCorners: null,
    polygonPoints: null,
    roundAnchors: null,
    roundPointCount: 4,
    roundPoints: null,
    fineTuneBase: null,
  };
}

const PLACEMENT_DIMENSION_SCALE = 0.68;
const PLACEMENT_QUAD_LIMIT = 120;
const PLACEMENT_QUAD_CORNERS = ["tl", "tr", "br", "bl"];
const PLACEMENT_ROUND_ANCHORS = ["top", "right", "bottom", "left"];
const PLACEMENT_ROUND_POINT_MIN = 4;
const PLACEMENT_ROUND_POINT_MAX = 100;

function roundPlacementBaseDimensions(shape) {
  return shape === "ellipse" ? { width: 120, height: 80 } : { width: 100, height: 100 };
}

function normalizePlacementLayout(layout) {
  const source = layout || {};
  const base = { ...createDefaultPlacement(), ...(layout || {}) };
  const legacyDiameter = numberOr(base.width ?? base.scale, 100);
  base.radius = clamp(numberOr(base.radius ?? legacyDiameter / 2, 50), 0, 90);
  const circleDiameter = base.radius * 2;
  base.circleWidth = clamp(numberOr(base.circleWidth ?? base.circleLongAxis ?? base.width, circleDiameter), 0, 180);
  base.circleHeight = clamp(numberOr(base.circleHeight ?? base.circleShortAxis ?? base.height, circleDiameter), 0, 180);
  base.sides = Math.round(clamp(numberOr(base.sides, 6), 3, 12));
  base.sideLength = clamp(roundToTenth(numberOr(base.sideLength ?? legacyDiameter * Math.sin(Math.PI / base.sides), 50)), 0, 140);
  base.rectLength = clamp(roundToTenth(numberOr(base.rectLength ?? base.width, 120)), 0, 180);
  base.rectWidth = clamp(roundToTenth(numberOr(base.rectWidth ?? base.height, 80)), 0, 180);
  base.longAxis = clamp(roundToTenth(numberOr(base.longAxis ?? base.width, 120)), 0, 180);
  base.shortAxis = clamp(roundToTenth(numberOr(base.shortAxis ?? base.height, 80)), 0, 180);
  const roundBase = roundPlacementBaseDimensions(base.shape);
  const roundScaleValue = Number(source.roundScale ?? source.uniformScale);
  const roundScaleFallback = Number.isFinite(roundScaleValue) ? roundScaleValue : null;
  const legacyRoundWidth =
    base.shape === "ellipse"
      ? numberOr(source.width ?? source.longAxis ?? source.circleWidth, roundScaleFallback === null ? base.longAxis : roundBase.width * (roundScaleFallback / 100))
      : numberOr(source.width ?? source.circleWidth ?? source.circleLongAxis, roundScaleFallback === null ? base.circleWidth : roundBase.width * (roundScaleFallback / 100));
  const legacyRoundHeight =
    base.shape === "ellipse"
      ? numberOr(source.height ?? source.shortAxis ?? source.circleHeight, roundScaleFallback === null ? base.shortAxis : roundBase.height * (roundScaleFallback / 100))
      : numberOr(source.height ?? source.circleHeight ?? source.circleShortAxis, roundScaleFallback === null ? base.circleHeight : roundBase.height * (roundScaleFallback / 100));
  base.stretchX = clamp(roundToTenth(numberOr(source.stretchX ?? source.roundScaleX ?? source.scaleX, (legacyRoundWidth / roundBase.width) * 100)), 0, 220);
  base.stretchY = clamp(roundToTenth(numberOr(source.stretchY ?? source.roundScaleY ?? source.scaleY, (legacyRoundHeight / roundBase.height) * 100)), 0, 220);
  base.circleWidth = clamp(roundBase.width * (base.stretchX / 100), 0, 220);
  base.circleHeight = clamp(roundBase.height * (base.stretchY / 100), 0, 220);
  if (base.shape === "circle" || base.shape === "ellipse") {
    base.longAxis = base.circleWidth;
    base.shortAxis = base.circleHeight;
  }
  base.fixedScale = clamp(roundToTenth(numberOr(base.fixedScale, 100)), 0, 180);
  base.rotation = clamp(roundToTenth(numberOr(base.rotation, 0)), -180, 180);
  base.fineTune = Boolean(base.fineTune) && (base.shape === "rectangle" || base.shape === "polygon" || base.shape === "circle" || base.shape === "ellipse");
  base.roundScale = clamp(roundToTenth(numberOr(source.roundScale ?? source.uniformScale, Math.max(base.stretchX, base.stretchY))), 0, 220);
  base.tuneLineColor = normalizeTuneLineColor(base.tuneLineColor);
  const roundDimensions = {
    width: clamp(base.circleWidth * PLACEMENT_DIMENSION_SCALE, 0, 94),
    height: clamp(base.circleHeight * PLACEMENT_DIMENSION_SCALE, 0, 94),
  };
  base.roundPointCount = normalizeRoundPointCount(source.roundPointCount ?? (Array.isArray(source.roundPoints) ? source.roundPoints.length : 4));
  base.roundPoints =
    base.shape === "circle" || base.shape === "ellipse"
      ? normalizePlacementRoundPoints(source.roundPoints ?? legacyRoundAnchorsToPoints(source.roundAnchors, roundDimensions), base.roundPointCount, roundDimensions)
      : null;
  base.roundAnchors = null;
  base.quadCorners =
    base.shape === "rectangle"
      ? normalizePlacementQuadCorners(base.quadCorners, {
          width: clamp(base.rectLength * PLACEMENT_DIMENSION_SCALE, 0, 94),
          height: clamp(base.rectWidth * PLACEMENT_DIMENSION_SCALE, 0, 94),
        })
      : null;
  base.polygonPoints =
    base.shape === "polygon"
      ? normalizePlacementPolygonPoints(base.polygonPoints, base.sides, {
          width: clamp((base.sideLength / Math.sin(Math.PI / base.sides)) * PLACEMENT_DIMENSION_SCALE, 0, 94),
          height: clamp((base.sideLength / Math.sin(Math.PI / base.sides)) * PLACEMENT_DIMENSION_SCALE, 0, 94),
        })
      : null;
  return base;
}

function placementRawDimensions(layout) {
  const normalized = normalizePlacementLayout(layout);
  if (isRoundPlacementShape(normalized)) {
    const roundBase = roundPlacementBaseDimensions(normalized.shape);
    return {
      width: roundBase.width * (normalized.stretchX / 100),
      height: roundBase.height * (normalized.stretchY / 100),
    };
  }
  if (normalized.shape === "polygon") {
    const diameter = normalized.sideLength / Math.sin(Math.PI / normalized.sides);
    return { width: diameter, height: diameter };
  }
  if (normalized.shape === "rectangle") {
    return { width: normalized.rectLength, height: normalized.rectWidth };
  }
  return {
    width: normalized.longAxis,
    height: normalized.shortAxis,
  };
}

function placementDimensions(layout, scaleMultiplier = 1) {
  const raw = placementRawDimensions(layout);
  return {
    width: clamp(raw.width * PLACEMENT_DIMENSION_SCALE * scaleMultiplier, 0, 94),
    height: clamp(raw.height * PLACEMENT_DIMENSION_SCALE * scaleMultiplier, 0, 94),
  };
}

function fixedCirclePlacementDimensions(scaleMultiplier = 1) {
  const diameter = roundPlacementBaseDimensions("circle").width;
  const size = clamp(diameter * PLACEMENT_DIMENSION_SCALE * scaleMultiplier, 0, 94);
  return { width: size, height: size };
}

function isFixedLayoutMode(layoutMode) {
  return layoutMode === "frontGallery" || layoutMode === "frontDuo" || layoutMode === "frontGrid" || layoutMode === "hero";
}

function placementDimensionsForView(layout, scaleMultiplier = 1, options = {}) {
  const normalized = normalizePlacementLayout(layout);
  if (options.preserveCircle && normalized.shape === "circle") {
    return fixedCirclePlacementDimensions(scaleMultiplier);
  }
  return placementDimensions(normalized, scaleMultiplier);
}

function defaultPlacementQuadCorners(dimensions) {
  const halfWidth = dimensions.width / 2;
  const halfHeight = dimensions.height / 2;
  return {
    tl: { x: -halfWidth, y: -halfHeight },
    tr: { x: halfWidth, y: -halfHeight },
    br: { x: halfWidth, y: halfHeight },
    bl: { x: -halfWidth, y: halfHeight },
  };
}

function normalizePlacementQuadCorners(corners, dimensions) {
  const fallback = defaultPlacementQuadCorners(dimensions);
  const source = corners && typeof corners === "object" ? corners : {};
  return PLACEMENT_QUAD_CORNERS.reduce((result, key) => {
    const point = source[key] || fallback[key];
    result[key] = {
      x: clamp(numberOr(point.x, fallback[key].x), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
      y: clamp(numberOr(point.y, fallback[key].y), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
    };
    return result;
  }, {});
}

function normalizeRoundPointCount(value) {
  return Math.round(clamp(numberOr(value, 4), PLACEMENT_ROUND_POINT_MIN, PLACEMENT_ROUND_POINT_MAX));
}

function defaultPlacementRoundAnchors(dimensions) {
  const halfWidth = dimensions.width / 2;
  const halfHeight = dimensions.height / 2;
  return {
    top: { x: 0, y: -halfHeight },
    right: { x: halfWidth, y: 0 },
    bottom: { x: 0, y: halfHeight },
    left: { x: -halfWidth, y: 0 },
  };
}

function legacyRoundAnchorsToPoints(anchors, dimensions) {
  if (!anchors || typeof anchors !== "object") return null;
  const fallback = defaultPlacementRoundAnchors(dimensions);
  const source = anchors;
  return PLACEMENT_ROUND_ANCHORS.map((key) => {
    const point = source[key] || fallback[key];
    return {
      x: clamp(numberOr(point.x, fallback[key].x), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
      y: clamp(numberOr(point.y, fallback[key].y), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
    };
  });
}

function defaultPlacementRoundPoints(count, dimensions) {
  const pointCount = normalizeRoundPointCount(count);
  const halfWidth = dimensions.width / 2;
  const halfHeight = dimensions.height / 2;
  return Array.from({ length: pointCount }, (_, index) => {
    const angle = -Math.PI / 2 + (index / pointCount) * Math.PI * 2;
    return {
      x: Math.cos(angle) * halfWidth,
      y: Math.sin(angle) * halfHeight,
    };
  });
}

function normalizePlacementRoundPoints(points, count, dimensions) {
  const pointCount = normalizeRoundPointCount(count);
  const fallback = defaultPlacementRoundPoints(pointCount, dimensions);
  const source = Array.isArray(points) && points.length === pointCount ? points : fallback;
  return fallback.map((fallbackPoint, index) => {
    const point = source[index] || fallbackPoint;
    return {
      x: clamp(numberOr(point.x, fallbackPoint.x), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
      y: clamp(numberOr(point.y, fallbackPoint.y), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
    };
  });
}

function placementQuadCorners(layout) {
  const normalized = normalizePlacementLayout(layout);
  return normalizePlacementQuadCorners(normalized.quadCorners, placementDimensions(normalized));
}

function placementRoundPoints(layout) {
  const normalized = normalizePlacementLayout(layout);
  if (isRoundPlacementShape(normalized) && !normalized.fineTune) {
    return defaultPlacementRoundPoints(4, placementDimensions(normalized));
  }
  return normalizePlacementRoundPoints(normalized.roundPoints, normalized.roundPointCount, placementDimensions(normalized));
}

function placementPointToElementPercent(point, dimensions) {
  return {
    x: dimensions.width > 0 ? 50 + (point.x / dimensions.width) * 100 : 50,
    y: dimensions.height > 0 ? 50 + (point.y / dimensions.height) * 100 : 50,
  };
}

function rotatePlacementPoint(point, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function imageLocalPointFromCanvas(point, center, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos,
  };
}

function imageLocalBoundsFromCanvasPoints(points, center, rotation) {
  return pointArrayBounds(points.map((point) => imageLocalPointFromCanvas(point, center, rotation)));
}

function defaultPlacementPolygonPoints(sides, dimensions) {
  const count = Math.round(clamp(Number(sides) || 6, 3, 12));
  const startAngle = regularPolygonStartAngle(count);
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2;
    return {
      x: Math.cos(angle) * (dimensions.width / 2),
      y: Math.sin(angle) * (dimensions.height / 2),
    };
  });
}

function normalizePlacementPolygonPoints(points, sides, dimensions) {
  const fallback = defaultPlacementPolygonPoints(sides, dimensions);
  const source = Array.isArray(points) && points.length === fallback.length ? points : fallback;
  return fallback.map((fallbackPoint, index) => {
    const point = source[index] || fallbackPoint;
    return {
      x: clamp(numberOr(point.x, fallbackPoint.x), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
      y: clamp(numberOr(point.y, fallbackPoint.y), -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
    };
  });
}

function placementPolygonPoints(layout) {
  const normalized = normalizePlacementLayout(layout);
  return normalizePlacementPolygonPoints(normalized.polygonPoints, normalized.sides, placementDimensions(normalized));
}

function fineTuneBaseSnapshot(layout) {
  const normalized = normalizePlacementLayout(layout);
  return {
    shape: normalized.shape,
    x: normalized.x,
    y: normalized.y,
    rotation: normalized.rotation,
    stretchX: normalized.stretchX,
    stretchY: normalized.stretchY,
    circleWidth: normalized.circleWidth,
    circleHeight: normalized.circleHeight,
    rectLength: normalized.rectLength,
    rectWidth: normalized.rectWidth,
    sideLength: normalized.sideLength,
    sides: normalized.sides,
    roundPointCount: normalized.roundPointCount,
  };
}

function prepareFineTuneLayout(layout) {
  const normalized = normalizePlacementLayout(layout);
  const dimensions = placementDimensions(normalized);
  const rotation = placementRotationRad(normalized);
  const next = {
    ...normalized,
    fineTune: true,
    fineTuneBase: fineTuneBaseSnapshot(normalized),
  };
  if (normalized.shape === "rectangle") {
    return normalizePlacementLayout({
      ...next,
      rectLength: normalized.rectLength,
      rectWidth: normalized.rectWidth,
      quadCorners: Object.fromEntries(PLACEMENT_QUAD_CORNERS.map((corner) => [corner, rotatePlacementPoint(defaultPlacementQuadCorners(dimensions)[corner], rotation)])),
    });
  }
  if (normalized.shape === "polygon") {
    return normalizePlacementLayout({
      ...next,
      sideLength: normalized.sideLength,
      sides: normalized.sides,
      polygonPoints: defaultPlacementPolygonPoints(normalized.sides, dimensions).map((point) => rotatePlacementPoint(point, rotation)),
    });
  }
  if (isRoundPlacementShape(normalized)) {
    return normalizePlacementLayout({
      ...next,
      stretchX: normalized.stretchX,
      stretchY: normalized.stretchY,
      circleWidth: normalized.circleWidth,
      circleHeight: normalized.circleHeight,
      roundPointCount: normalized.roundPointCount,
      roundPoints: defaultPlacementRoundPoints(normalized.roundPointCount, dimensions).map((point) => rotatePlacementPoint(point, rotation)),
    });
  }
  return next;
}

function fineTuneImageLayout(layout) {
  const normalized = normalizePlacementLayout(layout);
  const base = normalized.fineTuneBase;
  if (!normalized.fineTune || !base || base.shape !== normalized.shape) {
    return normalized;
  }
  return normalizePlacementLayout({
    ...normalized,
    fineTune: false,
    x: normalized.x,
    y: normalized.y,
    rotation: normalized.rotation,
    stretchX: base.stretchX,
    stretchY: base.stretchY,
    circleWidth: base.circleWidth,
    circleHeight: base.circleHeight,
    rectLength: base.rectLength,
    rectWidth: base.rectWidth,
    sideLength: base.sideLength,
    sides: base.sides,
    roundPointCount: base.roundPointCount,
    quadCorners: null,
    polygonPoints: null,
    roundPoints: null,
    fineTuneBase: null,
  });
}

function placementRenderMetrics(layout, scaleMultiplier = 1, options = {}) {
  const normalized = normalizePlacementLayout(layout);
  const dimensions = placementDimensionsForView(normalized, scaleMultiplier, options);
  const maxDimension = Math.max(dimensions.width, dimensions.height);
  if (maxDimension <= 0) {
    return {
      radius: 0,
      shapeModel: { shape: normalized.shape, sides: normalized.sides, x: 1, y: 1 },
    };
  }
  return {
    radius: maxDimension / 200,
    shapeModel: {
      shape: normalized.shape,
      sides: normalized.sides,
      x: clamp(dimensions.width / maxDimension, 0, 1),
      y: clamp(dimensions.height / maxDimension, 0, 1),
    },
  };
}

function placementRenderRadius(layout, scaleMultiplier = 1) {
  return placementRenderMetrics(layout, scaleMultiplier).radius;
}

function placementShapeRenderModel(layout, scaleMultiplier = 1) {
  return placementRenderMetrics(layout, scaleMultiplier).shapeModel;
}

function placementControlModel(layout) {
  const normalized = normalizePlacementLayout(layout);
  if (isRoundPlacementShape(normalized)) {
    return {
      primaryLabel: "横向边长",
      primaryKey: "circleWidth",
      primaryValue: Math.round(normalized.circleWidth * 10) / 10,
      primaryMin: 0,
      primaryMax: 220,
      primaryStep: 0.1,
      secondaryLabel: "纵向边长",
      secondaryKey: "circleHeight",
      secondaryValue: Math.round(normalized.circleHeight * 10) / 10,
      secondaryMin: 0,
      secondaryMax: 220,
      secondaryStep: 0.1,
    };
  }
  if (normalized.shape === "polygon") {
    return {
      primaryLabel: "边长",
      primaryKey: "sideLength",
      primaryValue: roundToTenth(normalized.sideLength),
      primaryMin: 0,
      primaryMax: 140,
      primaryStep: 0.1,
      showSides: true,
    };
  }
  if (normalized.shape === "rectangle") {
    return {
      primaryLabel: "长",
      primaryKey: "rectLength",
      primaryValue: roundToTenth(normalized.rectLength),
      primaryMin: 0,
      primaryMax: 180,
      primaryStep: 0.1,
      secondaryLabel: "宽",
      secondaryKey: "rectWidth",
      secondaryValue: roundToTenth(normalized.rectWidth),
      secondaryMin: 0,
      secondaryMax: 180,
      secondaryStep: 0.1,
    };
  }
  return {
    primaryLabel: "横向伸缩%",
    primaryKey: "stretchX",
    primaryValue: roundToTenth(normalized.stretchX),
    primaryMin: 0,
    primaryMax: 220,
    primaryStep: 0.1,
    secondaryLabel: "纵向伸缩%",
    secondaryKey: "stretchY",
    secondaryValue: roundToTenth(normalized.stretchY),
    secondaryMin: 0,
    secondaryMax: 220,
    secondaryStep: 0.1,
  };
}

function convertPlacementShape(layout, nextShape) {
  const normalized = normalizePlacementLayout(layout);
  const raw = placementRawDimensions(normalized);
  const long = Math.max(raw.width, raw.height);
  const short = Math.min(raw.width, raw.height);
  const sides = normalized.sides;
  const roundBase = roundPlacementBaseDimensions(nextShape);
  return normalizePlacementLayout({
    ...normalized,
    shape: nextShape,
    radius: short / 2,
    circleWidth: raw.width,
    circleHeight: raw.height,
    stretchX: (raw.width / roundBase.width) * 100,
    stretchY: (raw.height / roundBase.height) * 100,
    sideLength: long * Math.sin(Math.PI / sides),
    rectLength: long,
    rectWidth: short,
    longAxis: raw.width,
    shortAxis: raw.height,
    roundAnchors: null,
    roundPoints: null,
    quadCorners: null,
    polygonPoints: null,
  });
}

function regularPolygonClipPath(sides) {
  const count = Math.round(clamp(Number(sides) || 6, 3, 12));
  if (count === 4) return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
  const startAngle = regularPolygonStartAngle(count);
  const points = Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2;
    const x = 50 + Math.cos(angle) * 50;
    const y = 50 + Math.sin(angle) * 50;
    return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
  });
  return `polygon(${points.join(", ")})`;
}

function regularPolygonSvgPoints(sides) {
  const count = Math.round(clamp(Number(sides) || 6, 3, 12));
  if (count === 4) return "0,0 100,0 100,100 0,100";
  const startAngle = regularPolygonStartAngle(count);
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2;
    const x = 50 + Math.cos(angle) * 50;
    const y = 50 + Math.sin(angle) * 50;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function rectangleSvgPoints() {
  return "0,0 100,0 100,100 0,100";
}

function placementPolygonSvgPoints(layout, dimensions) {
  return placementPolygonPoints(layout)
    .map((point) => {
      const percent = placementPointToElementPercent(point, dimensions);
      return `${percent.x.toFixed(3)},${percent.y.toFixed(3)}`;
    })
    .join(" ");
}

function regularPolygonStartAngle(sides) {
  const count = Math.round(clamp(Number(sides) || 6, 3, 12));
  return count === 3 ? -Math.PI / 2 : -Math.PI / 2 - Math.PI / count;
}

function placementRotationRad(layout) {
  return (normalizePlacementLayout(layout).rotation * Math.PI) / 180;
}

function isRoundPlacementShape(layout) {
  const shape = normalizePlacementLayout(layout).shape;
  return shape === "circle" || shape === "ellipse";
}

function isFineTunePlacementShape(layout) {
  const shape = normalizePlacementLayout(layout).shape;
  return shape === "rectangle" || shape === "polygon" || shape === "circle" || shape === "ellipse";
}

function placementFineTuneLabel(layout) {
  const shape = normalizePlacementLayout(layout).shape;
  if (shape === "polygon") return "顶点微调";
  if (shape === "rectangle") return "四角微调";
  return "椭圆贴合微调";
}

function normalizeTuneLineColor(value) {
  if (value === "red" || value === "#f04438" || value === "#ff0000") return "red";
  return value === "white" || value === "#fff" || value === "#ffffff" ? "white" : "black";
}

function placementTuneLineColor(layout) {
  const color = normalizeTuneLineColor(layout?.tuneLineColor);
  if (color === "red") return "#f04438";
  return color === "white" ? "#ffffff" : "#111111";
}

function placementQuadSvgPoints(layout, dimensions) {
  const corners = placementQuadCorners(layout);
  return PLACEMENT_QUAD_CORNERS.map((corner) => {
    const point = placementPointToElementPercent(corners[corner], dimensions);
    return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  }).join(" ");
}

function placementCornerHandlesMarkup(layout, dimensions) {
  const corners = placementQuadCorners(layout);
  const labels = {
    tl: "左上角",
    tr: "右上角",
    br: "右下角",
    bl: "左下角",
  };
  return Object.entries(labels)
    .map(
      ([corner, label]) => {
        const point = placementPointToElementPercent(corners[corner], dimensions);
        return `<button class="placement-corner-handle" type="button" data-corner="${corner}" aria-label="微调${label}" style="left: ${point.x}%; top: ${point.y}%;"></button>`;
      },
    )
    .join("");
}

function placementPolygonHandlesMarkup(layout, dimensions) {
  return placementPolygonPoints(layout)
    .map((point, index) => {
      const percent = placementPointToElementPercent(point, dimensions);
      return `<button class="placement-corner-handle" type="button" data-point-index="${index}" aria-label="微调顶点 ${index + 1}" style="left: ${percent.x}%; top: ${percent.y}%;"></button>`;
    })
    .join("");
}

function roundPointPercent(layout, dimensions, index) {
  const points = placementRoundPoints(layout);
  const pointIndex = Math.round(clamp(Number(index), 0, points.length - 1));
  return points[pointIndex] ? placementPointToElementPercent(points[pointIndex], dimensions) : { x: 50, y: 50 };
}

function roundCurveControlPoints(points, index, tension = 0.22) {
  const count = points.length;
  const current = points[index];
  const next = points[(index + 1) % count];
  const previous = points[(index - 1 + count) % count];
  const afterNext = points[(index + 2) % count];
  return {
    c1: {
      x: current.x + (next.x - previous.x) * tension,
      y: current.y + (next.y - previous.y) * tension,
    },
    c2: {
      x: next.x - (afterNext.x - current.x) * tension,
      y: next.y - (afterNext.y - current.y) * tension,
    },
  };
}

function roundCurveSvgPathFromPoints(points) {
  if (!points.length) return "";
  const commands = [`M ${points[0].x.toFixed(3)} ${points[0].y.toFixed(3)}`];
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const { c1, c2 } = roundCurveControlPoints(points, index);
    commands.push(`C ${c1.x.toFixed(3)} ${c1.y.toFixed(3)} ${c2.x.toFixed(3)} ${c2.y.toFixed(3)} ${next.x.toFixed(3)} ${next.y.toFixed(3)}`);
  }
  commands.push("Z");
  return commands.join(" ");
}

function placementRoundCurveSvgPath(layout, dimensions) {
  const points = placementRoundPoints(layout).map((point) => placementPointToElementPercent(point, dimensions));
  return roundCurveSvgPathFromPoints(points);
}

function roundPlacementResizeHandlesMarkup(layout = null, dimensions = null) {
  const points = layout && dimensions ? placementRoundPoints(layout) : defaultPlacementRoundPoints(4, { width: 100, height: 100 });
  const anchorStyle = (index) => {
    if (!layout || !dimensions) return "";
    const point = roundPointPercent(layout, dimensions, index);
    return ` style="left: ${point.x}%; top: ${point.y}%;"`;
  };
  return points
    .map((_, index) => `<button class="placement-resize-handle placement-resize-handle--point" type="button" data-round-index="${index}" aria-label="微调点 ${index + 1}"${anchorStyle(index)}></button>`)
    .join("");
}

function coarsePlacementResizeHandlesMarkup(layout) {
  const normalized = normalizePlacementLayout(layout);
  if (!isFineTunePlacementShape(normalized)) return "";
  const handles = isRoundPlacementShape(normalized)
    ? [
        { corner: "tl", className: "placement-resize-handle--corner", label: "等比缩放" },
        { corner: "tr", className: "placement-resize-handle--corner", label: "等比缩放" },
        { corner: "br", className: "placement-resize-handle--corner", label: "等比缩放" },
        { corner: "bl", className: "placement-resize-handle--corner", label: "等比缩放" },
        { side: "left", axis: "x", className: "placement-resize-handle--x", label: "横向拉伸" },
        { side: "right", axis: "x", className: "placement-resize-handle--x", label: "横向拉伸" },
        { side: "top", axis: "y", className: "placement-resize-handle--y", label: "纵向拉伸" },
        { side: "bottom", axis: "y", className: "placement-resize-handle--y", label: "纵向拉伸" },
      ]
    : [
    { side: "left", axis: "x", className: "placement-resize-handle--x", label: "横向缩放" },
    { side: "right", axis: "x", className: "placement-resize-handle--x", label: "横向缩放" },
    { side: "top", axis: "y", className: "placement-resize-handle--y", label: "纵向缩放" },
    { side: "bottom", axis: "y", className: "placement-resize-handle--y", label: "纵向缩放" },
      ];
  return handles
    .map(
      (handle) =>
        `<button class="placement-resize-handle ${handle.className}" type="button"${handle.axis ? ` data-resize-axis="${handle.axis}"` : ""}${handle.side ? ` data-resize-side="${handle.side}"` : ""}${handle.corner ? ` data-resize-corner="${handle.corner}"` : ""} aria-label="${handle.label}"></button>`,
    )
    .join("");
}

function roundPlacementFineTuneMarkup(layout, dimensions) {
  return `
    <svg class="placement-outline-svg placement-outline-svg--round" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="${placementRoundCurveSvgPath(layout, dimensions)}"></path>
    </svg>
    ${roundPlacementResizeHandlesMarkup(layout, dimensions)}
  `;
}

function fitPlacementRectangleCorner(layout, corner, point) {
  const normalized = normalizePlacementLayout(layout);
  const localPoint = localPointFromCanvasPercent(normalized, point, { useRotation: !normalized.fineTune });
  const nextCorners = {
    ...placementQuadCorners(normalized),
    [corner]: {
      x: clamp(localPoint.x, -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
      y: clamp(localPoint.y, -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
    },
  };
  return normalizePlacementLayout({
    ...normalized,
    fineTune: true,
    quadCorners: nextCorners,
  });
}

function fitPlacementPolygonPoint(layout, index, point) {
  const normalized = normalizePlacementLayout(layout);
  const points = placementPolygonPoints(normalized);
  const pointIndex = Math.round(clamp(Number(index), 0, points.length - 1));
  const localPoint = localPointFromCanvasPercent(normalized, point, { useRotation: !normalized.fineTune });
  const nextPoints = points.map((item, currentIndex) =>
    currentIndex === pointIndex
      ? {
          x: clamp(localPoint.x, -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
          y: clamp(localPoint.y, -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
        }
      : item,
  );
  return normalizePlacementLayout({
    ...normalized,
    fineTune: true,
    polygonPoints: nextPoints,
  });
}

function fitRoundPlacementStretch(layout, axis, point, mode = "axis") {
  const normalized = normalizePlacementLayout(layout);
  if (!isRoundPlacementShape(normalized)) return normalized;
  const localPoint = localPointFromCanvasPercent(normalized, point);
  const roundBase = roundPlacementBaseDimensions(normalized.shape);
  const currentWidth = Math.max(0.1, normalized.circleWidth);
  const currentHeight = Math.max(0.1, normalized.circleHeight);
  const pointerWidth = (Math.abs(localPoint.x) * 2) / PLACEMENT_DIMENSION_SCALE;
  const pointerHeight = (Math.abs(localPoint.y) * 2) / PLACEMENT_DIMENSION_SCALE;
  const nextWidth =
    mode === "uniform"
      ? clamp(Math.round(currentWidth * Math.max(pointerWidth / currentWidth, pointerHeight / currentHeight) * 10) / 10, 0, 220)
      : axis === "x"
        ? clamp(Math.round(pointerWidth * 10) / 10, 0, 220)
        : normalized.circleWidth;
  const nextHeight =
    mode === "uniform"
      ? clamp(Math.round(currentHeight * Math.max(pointerWidth / currentWidth, pointerHeight / currentHeight) * 10) / 10, 0, 220)
      : axis === "y"
        ? clamp(Math.round(pointerHeight * 10) / 10, 0, 220)
        : normalized.circleHeight;
  return normalizePlacementLayout({
    ...normalized,
    circleWidth: nextWidth,
    circleHeight: nextHeight,
    longAxis: nextWidth,
    shortAxis: nextHeight,
    stretchX: (nextWidth / roundBase.width) * 100,
    stretchY: (nextHeight / roundBase.height) * 100,
    roundScale: Math.max((nextWidth / roundBase.width) * 100, (nextHeight / roundBase.height) * 100),
  });
}

function fitPlacementCoarseResize(layout, axis, point, mode = "axis") {
  const normalized = normalizePlacementLayout(layout);
  if (isRoundPlacementShape(normalized)) {
    return fitRoundPlacementStretch(normalized, axis, point, mode);
  }
  const localPoint = localPointFromCanvasPercent(normalized, point);
  const distance = Math.abs(axis === "x" ? localPoint.x : localPoint.y);
  const placementSize = distance * 2;
  if (normalized.shape === "rectangle") {
    return normalizePlacementLayout({
      ...normalized,
      [axis === "x" ? "rectLength" : "rectWidth"]: clamp(roundToTenth(placementSize / PLACEMENT_DIMENSION_SCALE), 0, 180),
      quadCorners: null,
    });
  }
  if (normalized.shape === "polygon") {
    const sideLength = (placementSize / PLACEMENT_DIMENSION_SCALE) * Math.sin(Math.PI / normalized.sides);
    return normalizePlacementLayout({
      ...normalized,
      sideLength: clamp(roundToTenth(sideLength), 0, 140),
      polygonPoints: null,
    });
  }
  return normalized;
}

function fitRoundPlacementPoint(layout, index, point) {
  const normalized = normalizePlacementLayout(layout);
  if (!isRoundPlacementShape(normalized)) return normalized;
  const points = placementRoundPoints(normalized);
  const pointIndex = Math.round(clamp(Number(index), 0, points.length - 1));
  const localPoint = localPointFromCanvasPercent(normalized, point, { useRotation: !normalized.fineTune });
  const nextPoints = points.map((item, currentIndex) =>
    currentIndex === pointIndex
      ? {
          x: clamp(localPoint.x, -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
          y: clamp(localPoint.y, -PLACEMENT_QUAD_LIMIT, PLACEMENT_QUAD_LIMIT),
        }
      : item,
  );
  return normalizePlacementLayout({
    ...normalized,
    fineTune: true,
    roundPoints: nextPoints,
    roundPointCount: points.length,
  });
}

function placementQuadCanvasPoints(layout, size) {
  const normalized = normalizePlacementLayout(layout);
  const rotation = normalized.fineTune ? 0 : placementRotationRad(normalized);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const center = {
    x: (normalized.x / 100) * size,
    y: (normalized.y / 100) * size,
  };
  const corners = placementQuadCorners(normalized);
  return PLACEMENT_QUAD_CORNERS.reduce((result, key) => {
    const local = {
      x: (corners[key].x / 100) * size,
      y: (corners[key].y / 100) * size,
    };
    result[key] = {
      x: center.x + local.x * cos - local.y * sin,
      y: center.y + local.x * sin + local.y * cos,
    };
    return result;
  }, {});
}

function traceQuad(ctx, points) {
  ctx.moveTo(points.tl.x, points.tl.y);
  ctx.lineTo(points.tr.x, points.tr.y);
  ctx.lineTo(points.br.x, points.br.y);
  ctx.lineTo(points.bl.x, points.bl.y);
  ctx.closePath();
}

function offsetQuad(points, dx, dy) {
  return PLACEMENT_QUAD_CORNERS.reduce((result, key) => {
    result[key] = { x: points[key].x + dx, y: points[key].y + dy };
    return result;
  }, {});
}

function quadBounds(points) {
  const values = PLACEMENT_QUAD_CORNERS.map((key) => points[key]);
  return {
    minX: Math.min(...values.map((point) => point.x)),
    maxX: Math.max(...values.map((point) => point.x)),
    minY: Math.min(...values.map((point) => point.y)),
    maxY: Math.max(...values.map((point) => point.y)),
  };
}

function placementPolygonCanvasPoints(layout, size) {
  const normalized = normalizePlacementLayout(layout);
  const rotation = normalized.fineTune ? 0 : placementRotationRad(normalized);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const center = {
    x: (normalized.x / 100) * size,
    y: (normalized.y / 100) * size,
  };
  return placementPolygonPoints(normalized).map((point) => {
    const local = {
      x: (point.x / 100) * size,
      y: (point.y / 100) * size,
    };
    return {
      x: center.x + local.x * cos - local.y * sin,
      y: center.y + local.x * sin + local.y * cos,
    };
  });
}

function placementRoundCanvasPoints(layout, size) {
  const normalized = normalizePlacementLayout(layout);
  const rotation = normalized.fineTune ? 0 : placementRotationRad(normalized);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const center = {
    x: (normalized.x / 100) * size,
    y: (normalized.y / 100) * size,
  };
  return placementRoundPoints(normalized).map((point) => {
    const local = {
      x: (point.x / 100) * size,
      y: (point.y / 100) * size,
    };
    return {
      x: center.x + local.x * cos - local.y * sin,
      y: center.y + local.x * sin + local.y * cos,
    };
  });
}

function traceRoundAnchorPath(ctx, points) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const { c1, c2 } = roundCurveControlPoints(points, index);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, next.x, next.y);
  }
  ctx.closePath();
}

function sampleRoundAnchorPath(points, segmentCount = 16) {
  const samples = [];
  const cubicPoint = (p0, c1, c2, p1, t) => {
    const inv = 1 - t;
    return {
      x: inv ** 3 * p0.x + 3 * inv ** 2 * t * c1.x + 3 * inv * t ** 2 * c2.x + t ** 3 * p1.x,
      y: inv ** 3 * p0.y + 3 * inv ** 2 * t * c1.y + 3 * inv * t ** 2 * c2.y + t ** 3 * p1.y,
    };
  };
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const { c1, c2 } = roundCurveControlPoints(points, index);
    for (let step = 0; step < segmentCount; step += 1) {
      samples.push(cubicPoint(current, c1, c2, next, step / segmentCount));
    }
  }
  return samples;
}

function roundCanvasEllipseMetrics(layout, size, offsetX = 0, offsetY = 0) {
  const normalized = normalizePlacementLayout(layout);
  const dimensions = placementDimensions(normalized);
  return {
    center: {
      x: (normalized.x / 100) * size + offsetX,
      y: (normalized.y / 100) * size + offsetY,
    },
    rx: Math.max(0.5, ((dimensions.width / 100) * size) / 2),
    ry: Math.max(0.5, ((dimensions.height / 100) * size) / 2),
    rotation: placementRotationRad(normalized),
  };
}

function traceRoundPlacementPath(ctx, layout, points, size, offsetX = 0, offsetY = 0) {
  const normalized = normalizePlacementLayout(layout);
  if (!normalized.fineTune) {
    const metrics = roundCanvasEllipseMetrics(normalized, size, offsetX, offsetY);
    ctx.ellipse(metrics.center.x, metrics.center.y, metrics.rx, metrics.ry, metrics.rotation, 0, Math.PI * 2);
    return;
  }
  traceRoundAnchorPath(ctx, offsetPointArray(points, offsetX, offsetY));
}

function sampleRoundPlacementPath(layout, points, size, segmentCount = 24, offsetX = 0, offsetY = 0) {
  const normalized = normalizePlacementLayout(layout);
  if (normalized.fineTune) {
    return sampleRoundAnchorPath(offsetPointArray(points, offsetX, offsetY), segmentCount);
  }
  const metrics = roundCanvasEllipseMetrics(normalized, size, offsetX, offsetY);
  return Array.from({ length: segmentCount * 4 }, (_, index) => {
    const angle = (index / (segmentCount * 4)) * Math.PI * 2;
    const localX = Math.cos(angle) * metrics.rx;
    const localY = Math.sin(angle) * metrics.ry;
    const cos = Math.cos(metrics.rotation);
    const sin = Math.sin(metrics.rotation);
    return {
      x: metrics.center.x + localX * cos - localY * sin,
      y: metrics.center.y + localX * sin + localY * cos,
    };
  });
}

function tracePointArray(ctx, points) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

function offsetPointArray(points, dx, dy) {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

function pointArrayBounds(points) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function mergeBounds(...boundsList) {
  return {
    minX: Math.min(...boundsList.map((bounds) => bounds.minX)),
    maxX: Math.max(...boundsList.map((bounds) => bounds.maxX)),
    minY: Math.min(...boundsList.map((bounds) => bounds.minY)),
    maxY: Math.max(...boundsList.map((bounds) => bounds.maxY)),
  };
}

function quadTextureAspect(layout) {
  const corners = placementQuadCorners(layout);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const top = distance(corners.tl, corners.tr);
  const bottom = distance(corners.bl, corners.br);
  const left = distance(corners.tl, corners.bl);
  const right = distance(corners.tr, corners.br);
  const width = Math.max(1, (top + bottom) / 2);
  const height = Math.max(1, (left + right) / 2);
  return width / height;
}

function getImageContentRect(image) {
  if (imageContentRectCache.has(image)) return imageContentRectCache.get(image);
  const fallback = { x: 0, y: 0, width: image.width, height: image.height };
  const sampleMax = 360;
  const scale = Math.min(1, sampleMax / Math.max(image.width, image.height));
  const sampleWidth = Math.max(1, Math.round(image.width * scale));
  const sampleHeight = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    imageContentRectCache.set(image, fallback);
    return fallback;
  }
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  } catch {
    imageContentRectCache.set(image, fallback);
    return fallback;
  }

  let minX = sampleWidth;
  let minY = sampleHeight;
  let maxX = -1;
  let maxY = -1;
  let matteMinX = sampleWidth;
  let matteMinY = sampleHeight;
  let matteMaxX = -1;
  let matteMaxY = -1;
  let transparentCount = 0;
  const pixelColor = (x, y) => {
    const index = (y * sampleWidth + x) * 4;
    return {
      r: pixels[index],
      g: pixels[index + 1],
      b: pixels[index + 2],
      a: pixels[index + 3],
    };
  };
  const sampleCorner = (x, y) => {
    const radius = Math.max(1, Math.min(6, Math.floor(sampleWidth / 8), Math.floor(sampleHeight / 8)));
    const startX = clamp(x ? sampleWidth - radius : 0, 0, sampleWidth - 1);
    const startY = clamp(y ? sampleHeight - radius : 0, 0, sampleHeight - 1);
    const endX = clamp(startX + radius, 1, sampleWidth);
    const endY = clamp(startY + radius, 1, sampleHeight);
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let count = 0;
    for (let py = startY; py < endY; py += 1) {
      for (let px = startX; px < endX; px += 1) {
        const color = pixelColor(px, py);
        r += color.r;
        g += color.g;
        b += color.b;
        a += color.a;
        count += 1;
      }
    }
    return {
      r: r / count,
      g: g / count,
      b: b / count,
      a: a / count,
    };
  };
  const colorDistance = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
  const cornerColors = [sampleCorner(0, 0), sampleCorner(1, 0), sampleCorner(0, 1), sampleCorner(1, 1)];
  const matteColor = cornerColors.reduce(
    (sum, color) => ({
      r: sum.r + color.r / cornerColors.length,
      g: sum.g + color.g / cornerColors.length,
      b: sum.b + color.b / cornerColors.length,
      a: sum.a + color.a / cornerColors.length,
    }),
    { r: 0, g: 0, b: 0, a: 0 },
  );
  const matteBrightness = (matteColor.r + matteColor.g + matteColor.b) / 3;
  const matteNeutrality = Math.max(matteColor.r, matteColor.g, matteColor.b) - Math.min(matteColor.r, matteColor.g, matteColor.b);
  const matteCornerSpread = Math.max(...cornerColors.map((color) => colorDistance(color, matteColor)));
  const hasLikelyLightMatte = matteColor.a > 220 && matteBrightness > 172 && matteNeutrality < 42 && matteCornerSpread < 42;

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const color = pixelColor(x, y);
      const alpha = color.a;
      if (alpha < 8) {
        transparentCount += 1;
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (!hasLikelyLightMatte || colorDistance(color, matteColor) > 36 || alpha < 230) {
        matteMinX = Math.min(matteMinX, x);
        matteMinY = Math.min(matteMinY, y);
        matteMaxX = Math.max(matteMaxX, x);
        matteMaxY = Math.max(matteMaxY, y);
      }
    }
  }

  const hasTransparentPadding = transparentCount > sampleWidth * sampleHeight * 0.01;
  const hasLightMattePadding =
    hasLikelyLightMatte &&
    matteMaxX >= matteMinX &&
    matteMaxY >= matteMinY &&
    (matteMinX > sampleWidth * 0.01 || matteMinY > sampleHeight * 0.01 || matteMaxX < sampleWidth * 0.99 || matteMaxY < sampleHeight * 0.99);
  if ((!hasTransparentPadding && !hasLightMattePadding) || maxX < minX || maxY < minY) {
    imageContentRectCache.set(image, fallback);
    return fallback;
  }

  if (hasLightMattePadding) {
    minX = matteMinX;
    minY = matteMinY;
    maxX = matteMaxX;
    maxY = matteMaxY;
  }

  const padding = 1;
  const rect = {
    x: clamp((minX - padding) / scale, 0, image.width),
    y: clamp((minY - padding) / scale, 0, image.height),
    width: clamp((maxX - minX + 1 + padding * 2) / scale, 1, image.width),
    height: clamp((maxY - minY + 1 + padding * 2) / scale, 1, image.height),
  };
  rect.width = Math.min(rect.width, image.width - rect.x);
  rect.height = Math.min(rect.height, image.height - rect.y);
  imageContentRectCache.set(image, rect);
  return rect;
}

function getFullImageRect(image) {
  return { x: 0, y: 0, width: image.width, height: image.height };
}

function coverSourceRect(image, targetAspect, baseRect = getImageContentRect(image)) {
  const imageAspect = baseRect.width / baseRect.height;
  if (imageAspect > targetAspect) {
    const width = baseRect.height * targetAspect;
    return {
      x: baseRect.x + (baseRect.width - width) / 2,
      y: baseRect.y,
      width,
      height: baseRect.height,
    };
  }
  const height = baseRect.width / targetAspect;
  return {
    x: baseRect.x,
    y: baseRect.y + (baseRect.height - height) / 2,
    width: baseRect.width,
    height,
  };
}

function interpolateQuadPoint(points, u, v) {
  const top = {
    x: points.tl.x + (points.tr.x - points.tl.x) * u,
    y: points.tl.y + (points.tr.y - points.tl.y) * u,
  };
  const bottom = {
    x: points.bl.x + (points.br.x - points.bl.x) * u,
    y: points.bl.y + (points.br.y - points.bl.y) * u,
  };
  return {
    x: top.x + (bottom.x - top.x) * v,
    y: top.y + (bottom.y - top.y) * v,
  };
}

function triangleTransform(source, target) {
  const [s0, s1, s2] = source;
  const [t0, t1, t2] = target;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.0001) return null;
  return {
    a: (t0.x * (s1.y - s2.y) + t1.x * (s2.y - s0.y) + t2.x * (s0.y - s1.y)) / denominator,
    b: (t0.y * (s1.y - s2.y) + t1.y * (s2.y - s0.y) + t2.y * (s0.y - s1.y)) / denominator,
    c: (t0.x * (s2.x - s1.x) + t1.x * (s0.x - s2.x) + t2.x * (s1.x - s0.x)) / denominator,
    d: (t0.y * (s2.x - s1.x) + t1.y * (s0.x - s2.x) + t2.y * (s1.x - s0.x)) / denominator,
    e:
      (t0.x * (s1.x * s2.y - s2.x * s1.y) +
        t1.x * (s2.x * s0.y - s0.x * s2.y) +
        t2.x * (s0.x * s1.y - s1.x * s0.y)) /
      denominator,
    f:
      (t0.y * (s1.x * s2.y - s2.x * s1.y) +
        t1.y * (s2.x * s0.y - s0.x * s2.y) +
        t2.y * (s0.x * s1.y - s1.x * s0.y)) /
      denominator,
  };
}

function drawImageTriangle(ctx, image, source, target) {
  const transform = triangleTransform(source, target);
  if (!transform) return;
  const minX = Math.max(0, Math.floor(Math.min(...source.map((point) => point.x)) - 1));
  const minY = Math.max(0, Math.floor(Math.min(...source.map((point) => point.y)) - 1));
  const maxX = Math.min(image.width, Math.ceil(Math.max(...source.map((point) => point.x)) + 1));
  const maxY = Math.min(image.height, Math.ceil(Math.max(...source.map((point) => point.y)) + 1));
  if (maxX <= minX || maxY <= minY) return;
  ctx.save();
  const clipTarget = expandTriangle(target, 0.9);
  ctx.beginPath();
  ctx.moveTo(clipTarget[0].x, clipTarget[0].y);
  ctx.lineTo(clipTarget[1].x, clipTarget[1].y);
  ctx.lineTo(clipTarget[2].x, clipTarget[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
  ctx.drawImage(image, minX, minY, maxX - minX, maxY - minY, minX, minY, maxX - minX, maxY - minY);
  ctx.restore();
}

function expandTriangle(points, amount) {
  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    return {
      x: point.x + (dx / distance) * amount,
      y: point.y + (dy / distance) * amount,
    };
  });
}

function drawImageWarpedToQuad(ctx, image, points, sourceRect, steps = 16) {
  if (steps <= 1) {
    const s00 = { x: sourceRect.x, y: sourceRect.y };
    const s10 = { x: sourceRect.x + sourceRect.width, y: sourceRect.y };
    const s11 = { x: sourceRect.x + sourceRect.width, y: sourceRect.y + sourceRect.height };
    const s01 = { x: sourceRect.x, y: sourceRect.y + sourceRect.height };
    drawImageTriangle(ctx, image, [s00, s10, s11], [points.tl, points.tr, points.br]);
    drawImageTriangle(ctx, image, [s00, s11, s01], [points.tl, points.br, points.bl]);
    return;
  }
  for (let y = 0; y < steps; y += 1) {
    const v0 = y / steps;
    const v1 = (y + 1) / steps;
    for (let x = 0; x < steps; x += 1) {
      const u0 = x / steps;
      const u1 = (x + 1) / steps;
      const p00 = interpolateQuadPoint(points, u0, v0);
      const p10 = interpolateQuadPoint(points, u1, v0);
      const p11 = interpolateQuadPoint(points, u1, v1);
      const p01 = interpolateQuadPoint(points, u0, v1);
      const s00 = { x: sourceRect.x + sourceRect.width * u0, y: sourceRect.y + sourceRect.height * v0 };
      const s10 = { x: sourceRect.x + sourceRect.width * u1, y: sourceRect.y + sourceRect.height * v0 };
      const s11 = { x: sourceRect.x + sourceRect.width * u1, y: sourceRect.y + sourceRect.height * v1 };
      const s01 = { x: sourceRect.x + sourceRect.width * u0, y: sourceRect.y + sourceRect.height * v1 };
      drawImageTriangle(ctx, image, [s00, s10, s11], [p00, p10, p11]);
      drawImageTriangle(ctx, image, [s00, s11, s01], [p00, p11, p01]);
    }
  }
}

function drawCustomRoundProductView(ctx, image, size, layout, depth, shadow, shine, material) {
  const normalized = normalizePlacementLayout(layout);
  const points = placementRoundCanvasPoints(normalized, size);
  const pathSamples = sampleRoundPlacementPath(normalized, points, size);
  const bounds = pointArrayBounds(pathSamples);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const sourceRect = getFullImageRect(image);
  const rotation = placementRotationRad(normalized);
  const center = {
    x: (normalized.x / 100) * size,
    y: (normalized.y / 100) * size,
  };
  const imageLayout = fineTuneImageLayout(normalized);
  const imagePathSamples = sampleRoundPlacementPath(imageLayout, placementRoundCanvasPoints(imageLayout, size), size);
  const imageBounds = mergeBounds(
    imageLocalBoundsFromCanvasPoints(imagePathSamples, center, rotation),
    imageLocalBoundsFromCanvasPoints(pathSamples, center, rotation),
  );
  const imageWidth = Math.max(1, imageBounds.maxX - imageBounds.minX);
  const imageHeight = Math.max(1, imageBounds.maxY - imageBounds.minY);
  const offsetX = Math.cos(rotation) * depth * 0.98 - Math.sin(rotation) * depth * 0.72;
  const offsetY = Math.sin(rotation) * depth * 0.98 + Math.cos(rotation) * depth * 0.72;

  if (shadow > 0) {
    ctx.save();
    ctx.globalAlpha = 0.46 * shadow;
    ctx.filter = `blur(${Math.max(18, depth * 1.24)}px)`;
    ctx.fillStyle = "rgba(32,38,36,0.68)";
    ctx.beginPath();
    traceRoundPlacementPath(ctx, normalized, points, size, offsetX * 1.14, offsetY * 1.32);
    ctx.fill();
    ctx.restore();
  }

  if (depth > 0.5) {
    const base = hexToRgb(state.options.edgeColor || "#8f9188");
    const layers = Math.max(22, Math.round(depth * 1.1));
    for (let i = layers; i >= 1; i -= 1) {
      const t = i / layers;
      const edgeBounds = pointArrayBounds(sampleRoundPlacementPath(normalized, points, size, 8, offsetX * t, offsetY * t));
      const edge = ctx.createLinearGradient(edgeBounds.minX, edgeBounds.minY, edgeBounds.maxX, edgeBounds.maxY);
      if (material === "metal") {
        edge.addColorStop(0, rgbString(tint(base, 0.42)));
        edge.addColorStop(0.48, rgbString(shadeColor(base, 0.2)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.46)));
      } else {
        edge.addColorStop(0, rgbString(tint(base, 0.18)));
        edge.addColorStop(0.54, rgbString(shadeColor(base, 0.08)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.52)));
      }
      ctx.save();
      ctx.globalAlpha = 0.72 + 0.2 * (1 - t);
      ctx.fillStyle = edge;
      ctx.beginPath();
      traceRoundPlacementPath(ctx, normalized, points, size, offsetX * t, offsetY * t);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.beginPath();
  traceRoundPlacementPath(ctx, normalized, points, size);
  ctx.clip();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.filter = "saturate(1.28) contrast(1.08) brightness(1.04)";
  ctx.drawImage(image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  ctx.filter = "none";
  const shade = ctx.createLinearGradient(imageBounds.minX, imageBounds.minY, imageBounds.maxX, imageBounds.maxY);
  shade.addColorStop(0, "rgba(255,255,255,0.035)");
  shade.addColorStop(0.58, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = shade;
  ctx.fillRect(imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  drawLocalLightingOverlay(ctx, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight, 1.05);
  drawLocalGlareStripe(ctx, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight, 1.1);
  if (material === "acrylic") {
    const gloss = ctx.createRadialGradient(imageBounds.minX + imageWidth * 0.34, imageBounds.minY + imageHeight * 0.18, imageWidth * 0.04, imageBounds.minX + imageWidth * 0.44, imageBounds.minY + imageHeight * 0.28, Math.max(imageWidth, imageHeight) * 0.36);
    gloss.addColorStop(0, `rgba(255,255,255,${0.026 + shine * 0.03})`);
    gloss.addColorStop(0.48, `rgba(255,255,255,${0.008 + shine * 0.012})`);
    gloss.addColorStop(0.82, "rgba(255,255,255,0)");
    gloss.addColorStop(1, "rgba(0,0,0,0.055)");
    ctx.fillStyle = gloss;
    ctx.fillRect(imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  }
  ctx.restore();

  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1, size * 0.001);
  ctx.beginPath();
  traceRoundPlacementPath(ctx, normalized, points, size);
  ctx.stroke();
  ctx.restore();
}

function drawQuadProductView(ctx, image, size, layout, depth, shadow, shine, material) {
  const normalized = normalizePlacementLayout(layout);
  const points = placementQuadCanvasPoints(normalized, size);
  const bounds = quadBounds(points);
  const sourceRect = getFullImageRect(image);
  const rotation = placementRotationRad(normalized);
  const center = {
    x: (normalized.x / 100) * size,
    y: (normalized.y / 100) * size,
  };
  const imageBounds = imageLocalBoundsFromCanvasPoints(PLACEMENT_QUAD_CORNERS.map((key) => points[key]), center, rotation);
  const imageWidth = Math.max(1, imageBounds.maxX - imageBounds.minX);
  const imageHeight = Math.max(1, imageBounds.maxY - imageBounds.minY);
  const offsetX = Math.cos(rotation) * depth * 0.98 - Math.sin(rotation) * depth * 0.72;
  const offsetY = Math.sin(rotation) * depth * 0.98 + Math.cos(rotation) * depth * 0.72;

  if (shadow > 0) {
    ctx.save();
    ctx.globalAlpha = 0.46 * shadow;
    ctx.filter = `blur(${Math.max(18, depth * 1.24)}px)`;
    ctx.fillStyle = "rgba(32,38,36,0.68)";
    ctx.beginPath();
    traceQuad(ctx, offsetQuad(points, offsetX * 1.14, offsetY * 1.32));
    ctx.fill();
    ctx.restore();
  }

  if (depth > 0.5) {
    const base = hexToRgb(state.options.edgeColor || "#8f9188");
    const layers = Math.max(22, Math.round(depth * 1.1));
    for (let i = layers; i >= 1; i -= 1) {
      const t = i / layers;
      const edgePoints = offsetQuad(points, offsetX * t, offsetY * t);
      const edgeBounds = quadBounds(edgePoints);
      const edge = ctx.createLinearGradient(edgeBounds.minX, edgeBounds.minY, edgeBounds.maxX, edgeBounds.maxY);
      if (material === "metal") {
        edge.addColorStop(0, rgbString(tint(base, 0.42)));
        edge.addColorStop(0.48, rgbString(shadeColor(base, 0.2)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.46)));
      } else {
        edge.addColorStop(0, rgbString(tint(base, 0.18)));
        edge.addColorStop(0.54, rgbString(shadeColor(base, 0.08)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.52)));
      }
      ctx.save();
      ctx.globalAlpha = 0.72 + 0.2 * (1 - t);
      ctx.fillStyle = edge;
      ctx.beginPath();
      traceQuad(ctx, edgePoints);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.beginPath();
  traceQuad(ctx, points);
  ctx.clip();
  if (normalized.fineTune) {
    const targetBounds = quadBounds(points);
    const targetWidth = Math.max(1, targetBounds.maxX - targetBounds.minX);
    const targetHeight = Math.max(1, targetBounds.maxY - targetBounds.minY);
    ctx.filter = "saturate(1.28) contrast(1.08) brightness(1.04)";
    drawImageWarpedToQuad(ctx, image, points, sourceRect, 1);
    ctx.filter = "none";
    const shade = ctx.createLinearGradient(targetBounds.minX, targetBounds.minY, targetBounds.maxX, targetBounds.maxY);
    shade.addColorStop(0, "rgba(255,255,255,0.035)");
    shade.addColorStop(0.58, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = shade;
    ctx.fillRect(targetBounds.minX, targetBounds.minY, targetWidth, targetHeight);
    drawLocalLightingOverlay(ctx, targetBounds.minX, targetBounds.minY, targetWidth, targetHeight, 1.05);
    drawLocalGlareStripe(ctx, targetBounds.minX, targetBounds.minY, targetWidth, targetHeight, 1.1);
    if (material === "acrylic") {
      const gloss = ctx.createLinearGradient(targetBounds.minX, targetBounds.minY, targetBounds.maxX, targetBounds.minY + targetHeight * 0.5);
      gloss.addColorStop(0, `rgba(255,255,255,${0.04 + shine * 0.055})`);
      gloss.addColorStop(0.44, `rgba(255,255,255,${0.01 + shine * 0.018})`);
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gloss;
      ctx.fillRect(targetBounds.minX, targetBounds.minY, targetWidth, targetHeight);
    }
    ctx.restore();

    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = Math.max(1, size * 0.001);
    ctx.beginPath();
    traceQuad(ctx, points);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.filter = "saturate(1.28) contrast(1.08) brightness(1.04)";
  ctx.drawImage(image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  ctx.filter = "none";
  const shade = ctx.createLinearGradient(imageBounds.minX, imageBounds.minY, imageBounds.maxX, imageBounds.maxY);
  shade.addColorStop(0, "rgba(255,255,255,0.035)");
  shade.addColorStop(0.58, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = shade;
  ctx.fillRect(imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  drawLocalLightingOverlay(ctx, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight, 1.05);
  drawLocalGlareStripe(ctx, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight, 1.1);
  if (material === "acrylic") {
    const gloss = ctx.createLinearGradient(imageBounds.minX, imageBounds.minY, imageBounds.maxX, imageBounds.minY + imageHeight * 0.5);
    gloss.addColorStop(0, `rgba(255,255,255,${0.04 + shine * 0.055})`);
    gloss.addColorStop(0.44, `rgba(255,255,255,${0.01 + shine * 0.018})`);
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  }
  ctx.restore();

  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1, size * 0.001);
  ctx.beginPath();
  traceQuad(ctx, points);
  ctx.stroke();
  ctx.restore();
}

function drawCustomPolygonProductView(ctx, image, size, layout, depth, shadow, shine, material) {
  const normalized = normalizePlacementLayout(layout);
  const points = placementPolygonCanvasPoints(normalized, size);
  if (points.length < 3) return;
  const bounds = pointArrayBounds(points);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const sourceRect = getFullImageRect(image);
  const rotation = placementRotationRad(normalized);
  const center = {
    x: (normalized.x / 100) * size,
    y: (normalized.y / 100) * size,
  };
  const imageBounds = imageLocalBoundsFromCanvasPoints(points, center, rotation);
  const imageWidth = Math.max(1, imageBounds.maxX - imageBounds.minX);
  const imageHeight = Math.max(1, imageBounds.maxY - imageBounds.minY);
  const offsetX = Math.cos(rotation) * depth * 0.98 - Math.sin(rotation) * depth * 0.72;
  const offsetY = Math.sin(rotation) * depth * 0.98 + Math.cos(rotation) * depth * 0.72;

  if (shadow > 0) {
    ctx.save();
    ctx.globalAlpha = 0.46 * shadow;
    ctx.filter = `blur(${Math.max(18, depth * 1.24)}px)`;
    ctx.fillStyle = "rgba(32,38,36,0.68)";
    ctx.beginPath();
    tracePointArray(ctx, offsetPointArray(points, offsetX * 1.14, offsetY * 1.32));
    ctx.fill();
    ctx.restore();
  }

  if (depth > 0.5) {
    const base = hexToRgb(state.options.edgeColor || "#8f9188");
    const layers = Math.max(22, Math.round(depth * 1.1));
    for (let i = layers; i >= 1; i -= 1) {
      const t = i / layers;
      const edgePoints = offsetPointArray(points, offsetX * t, offsetY * t);
      const edgeBounds = pointArrayBounds(edgePoints);
      const edge = ctx.createLinearGradient(edgeBounds.minX, edgeBounds.minY, edgeBounds.maxX, edgeBounds.maxY);
      if (material === "metal") {
        edge.addColorStop(0, rgbString(tint(base, 0.42)));
        edge.addColorStop(0.48, rgbString(shadeColor(base, 0.2)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.46)));
      } else {
        edge.addColorStop(0, rgbString(tint(base, 0.18)));
        edge.addColorStop(0.54, rgbString(shadeColor(base, 0.08)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.52)));
      }
      ctx.save();
      ctx.globalAlpha = 0.72 + 0.2 * (1 - t);
      ctx.fillStyle = edge;
      ctx.beginPath();
      tracePointArray(ctx, edgePoints);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.beginPath();
  tracePointArray(ctx, points);
  ctx.clip();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.filter = "saturate(1.28) contrast(1.08) brightness(1.04)";
  ctx.drawImage(image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  ctx.filter = "none";
  const shade = ctx.createLinearGradient(imageBounds.minX, imageBounds.minY, imageBounds.maxX, imageBounds.maxY);
  shade.addColorStop(0, "rgba(255,255,255,0.035)");
  shade.addColorStop(0.58, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = shade;
  ctx.fillRect(imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  drawLocalLightingOverlay(ctx, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight, 1.05);
  drawLocalGlareStripe(ctx, imageBounds.minX, imageBounds.minY, imageWidth, imageHeight, 1.1);
  if (material === "acrylic") {
    const gloss = ctx.createLinearGradient(imageBounds.minX, imageBounds.minY, imageBounds.maxX, imageBounds.minY + imageHeight * 0.5);
    gloss.addColorStop(0, `rgba(255,255,255,${0.04 + shine * 0.055})`);
    gloss.addColorStop(0.44, `rgba(255,255,255,${0.01 + shine * 0.018})`);
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gloss;
    ctx.fillRect(imageBounds.minX, imageBounds.minY, imageWidth, imageHeight);
  }
  ctx.restore();

  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = Math.max(1, size * 0.001);
  ctx.beginPath();
  tracePointArray(ctx, points);
  ctx.stroke();
  ctx.restore();
}

function localPointFromCanvasPercent(layout, point, { useRotation = true } = {}) {
  const normalized = normalizePlacementLayout(layout);
  const rotation = useRotation ? placementRotationRad(normalized) : 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const delta = {
    x: point.x - normalized.x,
    y: point.y - normalized.y,
  };
  return {
    x: delta.x * cos + delta.y * sin,
    y: -delta.x * sin + delta.y * cos,
  };
}

function getLayoutPlaceholderViews(layoutMode) {
  if (layoutMode === "frontGallery") {
    return [
      { cx: 0.40, cy: 0.52, r: 0.305, x: 1, y: 1, rot: 0 },
      { cx: 0.76, cy: 0.30, r: 0.135, x: 1, y: 1, rot: 0 },
      { cx: 0.80, cy: 0.53, r: 0.145, x: 1, y: 1, rot: 0 },
      { cx: 0.73, cy: 0.75, r: 0.12, x: 1, y: 1, rot: 0 },
    ];
  }
  if (layoutMode === "frontDuo") {
    return [
      { cx: 0.36, cy: 0.52, r: 0.30, x: 1, y: 1, rot: 0 },
      { cx: 0.68, cy: 0.52, r: 0.22, x: 1, y: 1, rot: 0 },
    ];
  }
  if (layoutMode === "frontGrid") {
    return [
      { cx: 0.33, cy: 0.34, r: 0.18, x: 1, y: 1, rot: 0 },
      { cx: 0.67, cy: 0.34, r: 0.18, x: 1, y: 1, rot: 0 },
      { cx: 0.33, cy: 0.68, r: 0.18, x: 1, y: 1, rot: 0 },
      { cx: 0.67, cy: 0.68, r: 0.18, x: 1, y: 1, rot: 0 },
    ];
  }
  if (layoutMode === "gallery") {
    return [
      { cx: 0.4, cy: 0.52, r: 0.305, x: 1, y: 1, rot: -0.035 },
      { cx: 0.76, cy: 0.3, r: 0.135, x: 0.66, y: 0.98, rot: -0.08 },
      { cx: 0.8, cy: 0.53, r: 0.145, x: 0.74, y: 0.96, rot: 0.04 },
      { cx: 0.73, cy: 0.75, r: 0.12, x: 0.86, y: 0.93, rot: 0.1 },
    ];
  }
  if (layoutMode === "duo") {
    return [
      { cx: 0.38, cy: 0.54, r: 0.32, x: 1, y: 1, rot: -0.04 },
      { cx: 0.72, cy: 0.48, r: 0.22, x: 0.58, y: 0.98, rot: 0.04 },
    ];
  }
  if (layoutMode === "triptych") {
    return [
      { cx: 0.28, cy: 0.56, r: 0.19, x: 0.74, y: 0.98, rot: -0.11 },
      { cx: 0.5, cy: 0.48, r: 0.25, x: 1, y: 1, rot: 0.02 },
      { cx: 0.72, cy: 0.58, r: 0.19, x: 0.74, y: 0.98, rot: 0.13 },
    ];
  }
  if (layoutMode === "catalog") {
    return [
      { cx: 0.32, cy: 0.34, r: 0.18, x: 1, y: 1, rot: -0.04 },
      { cx: 0.68, cy: 0.34, r: 0.18, x: 0.68, y: 0.98, rot: 0.05 },
      { cx: 0.32, cy: 0.7, r: 0.18, x: 0.7, y: 0.98, rot: -0.05 },
      { cx: 0.68, cy: 0.7, r: 0.18, x: 1, y: 1, rot: 0.04 },
    ];
  }
  if (layoutMode === "floating") {
    return [
      { cx: 0.45, cy: 0.45, r: 0.29, x: 0.92, y: 1, rot: -0.22 },
      { cx: 0.68, cy: 0.65, r: 0.17, x: 0.7, y: 0.98, rot: 0.22 },
      { cx: 0.25, cy: 0.72, r: 0.13, x: 0.72, y: 0.98, rot: -0.28 },
    ];
  }
  return [{ cx: 0.5, cy: 0.49, r: 0.36, x: 1, y: 1, rot: -0.03 }];
}

function getFixedLayoutPlaceholderViews(layoutMode) {
  return getLayoutPlaceholderViews(layoutMode).map((view) => ({ ...view, rot: 0 }));
}

function placementShapeMarkup(layout, view, options = {}) {
  const normalized = normalizePlacementLayout(layout);
  const dimensions = placementDimensionsForView(normalized, options.scaleMultiplier ?? 1, options);
  const scale = view.r / 0.34;
  const viewScaleX = options.preserveCircle && normalized.shape === "circle" ? 1 : view.x ?? 1;
  const viewScaleY = options.preserveCircle && normalized.shape === "circle" ? 1 : view.y ?? 1;
  const width = clamp(dimensions.width * scale * viewScaleX, 0, 98);
  const height = clamp(dimensions.height * scale * viewScaleY, 0, 98);
  const fineTuneActive = Boolean(options.fineTuneActive) && isFineTunePlacementShape(normalized);
  const cornerTune = fineTuneActive && normalized.shape === "rectangle";
  const polygonTune = fineTuneActive && normalized.shape === "polygon";
  const roundTune = fineTuneActive && isRoundPlacementShape(normalized);
  const coarseResize = options.draggable && !fineTuneActive && isFineTunePlacementShape(normalized);
  const roundCoarseBox = coarseResize && isRoundPlacementShape(normalized);
  const classes = [
    "placement-stage-shape",
    `placement-stage-shape--${normalized.shape}`,
    options.draggable ? "placement-stage-shape--draggable" : "placement-stage-shape--fixed",
    roundTune || coarseResize ? "placement-stage-shape--resizable" : "",
    fineTuneActive ? "placement-stage-shape--fine-tune" : "",
    roundCoarseBox ? "placement-stage-shape--round-box" : "",
  ].join(" ");
  const content =
    normalized.shape === "polygon"
      ? `<svg class="placement-outline-svg placement-outline-svg--polygon" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="${polygonTune ? placementPolygonSvgPoints(normalized, dimensions) : regularPolygonSvgPoints(normalized.sides)}"></polygon></svg>${polygonTune ? placementPolygonHandlesMarkup(normalized, dimensions) : coarseResize ? coarsePlacementResizeHandlesMarkup(normalized) : ""}`
      : cornerTune
        ? `<svg class="placement-quad-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="${placementQuadSvgPoints(normalized, dimensions)}"></polygon></svg>${placementCornerHandlesMarkup(normalized, dimensions)}`
        : normalized.shape === "rectangle"
          ? `<svg class="placement-outline-svg placement-outline-svg--rectangle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="${rectangleSvgPoints()}"></polygon></svg>${coarseResize ? coarsePlacementResizeHandlesMarkup(normalized) : ""}`
        : roundTune
          ? roundPlacementFineTuneMarkup(normalized, dimensions)
          : `<span></span>${coarseResize ? coarsePlacementResizeHandlesMarkup(normalized) : ""}`;
  return `
    <div
      class="${classes}"
      style="left: ${(view.cx * 100).toFixed(3)}%; top: ${(view.cy * 100).toFixed(3)}%; width: ${width}%; height: ${height}%; --shape-rotate: ${fineTuneActive ? 0 : view.rot || 0}rad; --polygon-path: ${regularPolygonClipPath(normalized.sides)}; --tune-color: ${placementTuneLineColor(normalized)};"
    >
      ${content}
    </div>
  `;
}

function badgeMarkerMarkup() {
  normalizeBadgePosition();
  const markerSize = badgeMarkerSizePercent();
  return `
    <div class="badge-marker" style="left: ${state.options.badgeX}%; top: ${state.options.badgeY}%; width: ${markerSize}%;" title="拖动 2D FLAT 标识">
      <canvas class="badge-marker-canvas" width="512" height="512" aria-hidden="true"></canvas>
    </div>
  `;
}

function spotlightControlMarkup() {
  const strength = clamp(numberOr(state.options.spotlight, 0), 0, 100);
  if (strength <= 0) return "";
  const x = clamp(numberOr(state.options.spotlightX, 38), 0, 100);
  const y = clamp(numberOr(state.options.spotlightY, 34), 0, 100);
  const width = clamp(numberOr(state.options.spotlightWidth ?? state.options.spotlightSize, 46), 1, 140);
  const height = clamp(numberOr(state.options.spotlightHeight ?? state.options.spotlightSize, 46), 1, 140);
  const rotation = clamp(numberOr(state.options.spotlightRotation, 0), -180, 180);
  const color = state.options.spotlightColor || "#ffffff";
  return `
    <div
      class="spotlight-control"
      style="left:${x}%; top:${y}%; width:${width}%; height:${height}%; --spotlight-rotate:${rotation}deg; --spotlight-color:${color}; --spotlight-alpha:${0.16 + (strength / 100) * 0.42};"
      title="拖动移动光斑，拉动控制点调整大小和压缩"
    >
      <span class="spotlight-control__glow"></span>
      <button class="spotlight-rotate-handle" type="button" data-spotlight-rotate aria-label="旋转光斑"></button>
      ${["tl", "tr", "br", "bl"].map((corner) => `<button class="spotlight-handle spotlight-handle--corner" type="button" data-spotlight-corner="${corner}" aria-label="调整光斑大小"></button>`).join("")}
      ${[
        ["left", "x"],
        ["right", "x"],
        ["top", "y"],
        ["bottom", "y"],
      ].map(([side, axis]) => `<button class="spotlight-handle spotlight-handle--side" type="button" data-spotlight-side="${side}" data-spotlight-axis="${axis}" aria-label="压缩光斑"></button>`).join("")}
    </div>
  `;
}

function paintBadgeMarkerCanvases(root = document) {
  root.querySelectorAll(".badge-marker-canvas").forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    const size = canvas.width;
    const markerSize = badgeMarkerSizePercent();
    const virtualSize = size / (markerSize / 100);
    const radius = virtualSize * (badgeRadiusPercent() / 100);
    ctx.clearRect(0, 0, size, size);
    drawBadgeShape(ctx, size / 2, size / 2, radius, virtualSize);
  });
}

function bindBadgeMarkerDrag(container, badgeMarker, message = "2D FLAT 标识位置已更新，可以重新生成") {
  if (!container || !badgeMarker) return;
  let isDraggingBadge = false;
  const pointerToContainerPercent = (event) => {
    const rect = container.getBoundingClientRect();
    const left = rect.left + container.clientLeft;
    const top = rect.top + container.clientTop;
    const width = container.clientWidth || rect.width;
    const height = container.clientHeight || rect.height;
    return {
      x: clamp(((event.clientX - left) / width) * 100, 0, 100),
      y: clamp(((event.clientY - top) / height) * 100, 0, 100),
    };
  };
  const moveBadge = (event) => {
    const { x, y } = pointerToContainerPercent(event);
    const { min, max } = badgePositionBounds();
    state.options.badgeX = clamp(Math.round(x * 10) / 10, min, max);
    state.options.badgeY = clamp(Math.round(y * 10) / 10, min, max);
    badgeMarker.style.left = `${state.options.badgeX}%`;
    badgeMarker.style.top = `${state.options.badgeY}%`;
  };
  const stopBadgeDrag = (event) => {
    if (!isDraggingBadge) return;
    isDraggingBadge = false;
    if (event && typeof event.pointerId === "number" && badgeMarker.hasPointerCapture?.(event.pointerId)) {
      badgeMarker.releasePointerCapture(event.pointerId);
    }
    clearRendered();
    updateUi(message);
  };

  badgeMarker.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    isDraggingBadge = true;
    badgeMarker.setPointerCapture(event.pointerId);
    moveBadge(event);
  });
  badgeMarker.addEventListener("pointermove", (event) => {
    if (!isDraggingBadge) return;
    event.preventDefault();
    event.stopPropagation();
    moveBadge(event);
  });
  badgeMarker.addEventListener("pointerup", (event) => {
    event.stopPropagation();
    stopBadgeDrag(event);
  });
  badgeMarker.addEventListener("pointercancel", stopBadgeDrag);
}

async function renderProduct(file, options, backgroundItem) {
  const source = await loadImage(file);
  try {
    return await renderProductFromSource(source, options, backgroundItem);
  } finally {
    releaseDecodedImage(source);
  }
}

async function renderProductFromSource(source, options, backgroundItem, canvas = document.createElement("canvas")) {
  const size = options.size;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  drawBackground(ctx, size, backgroundItem);

  const depth = options.depth * (size / 1200);
  const shadow = options.shadow / 100;
  const shine = options.shine / 100;
  const layoutMode = getBackgroundLayoutMode(backgroundItem);
  const placementLayout = placementLayoutForBackground(backgroundItem);
  const fixedScaleMultiplier = layoutMode === "free" ? 1 : placementLayout.fixedScale / 100;
  const renderMetrics = placementRenderMetrics(placementLayout, fixedScaleMultiplier, { preserveCircle: isFixedLayoutMode(layoutMode) });
  const renderShapeModel = { ...renderMetrics.shapeModel, fixedRotation: layoutMode !== "free" };
  const productScale = layoutMode === "free" ? 1 : renderMetrics.radius / 0.34;

  if (layoutMode === "free") {
    if (isRoundPlacementShape(placementLayout)) {
      drawCustomRoundProductView(ctx, source, size, placementLayout, depth * 1.16, shadow, shine, options.material);
    } else if (placementLayout.shape === "rectangle") {
      drawQuadProductView(ctx, source, size, placementLayout, depth * 1.16, shadow, shine, options.material);
    } else if (placementLayout.shape === "polygon") {
      drawCustomPolygonProductView(ctx, source, size, placementLayout, depth * 1.16, shadow, shine, options.material);
    }
  } else if (productScale <= 0) {
    // A fixed overall scale of 0 means render only the background and optional label.
  } else if (layoutMode === "frontGallery") {
    drawStudioFloor(ctx, size, backgroundItem);
    drawBadgeView(ctx, source, size, { cx: 0.40, cy: 0.52, r: 0.305, depth: 1.16, x: 1, y: 1, yaw: 0, rot: 0, primary: true }, depth, shadow, shine, options.material, productScale, renderShapeModel);
    [
      { cx: 0.76, cy: 0.30, r: 0.135 },
      { cx: 0.80, cy: 0.53, r: 0.145 },
      { cx: 0.73, cy: 0.75, r: 0.12 },
    ].forEach((view) => drawBadgeView(ctx, source, size, { ...view, depth: 0.72, x: 1, y: 1, yaw: 0, rot: 0, primary: false }, depth, shadow * 0.9, shine * 0.92, options.material, productScale, renderShapeModel));
  } else if (layoutMode === "frontDuo") {
    drawStudioFloor(ctx, size, backgroundItem);
    drawBadgeView(ctx, source, size, { cx: 0.36, cy: 0.52, r: 0.30, depth: 1.14, x: 1, y: 1, yaw: 0, rot: 0, primary: true }, depth, shadow, shine, options.material, productScale, renderShapeModel);
    drawBadgeView(ctx, source, size, { cx: 0.68, cy: 0.52, r: 0.22, depth: 0.9, x: 1, y: 1, yaw: 0, rot: 0, primary: false }, depth, shadow * 0.86, shine * 0.92, options.material, productScale, renderShapeModel);
  } else if (layoutMode === "frontGrid") {
    drawStudioFloor(ctx, size, backgroundItem);
    [
      { cx: 0.33, cy: 0.34, r: 0.18, primary: true },
      { cx: 0.67, cy: 0.34, r: 0.18, primary: false },
      { cx: 0.33, cy: 0.68, r: 0.18, primary: false },
      { cx: 0.67, cy: 0.68, r: 0.18, primary: true },
    ].forEach((view) => drawBadgeView(ctx, source, size, { ...view, depth: 0.82, x: 1, y: 1, yaw: 0, rot: 0 }, depth, shadow * 0.82, shine * 0.92, options.material, productScale, renderShapeModel));
  } else if (layoutMode === "gallery") {
    drawStudioFloor(ctx, size, backgroundItem);
    drawBadgeView(ctx, source, size, { cx: 0.40, cy: 0.52, r: 0.305, depth: 1.16, x: 1, y: 1, yaw: 0, rot: -0.035, primary: true }, depth, shadow, shine, options.material, productScale, renderShapeModel);
    [
      { cx: 0.76, cy: 0.30, r: 0.135, x: 0.66, y: 0.98, yaw: 1, rot: -0.08 },
      { cx: 0.80, cy: 0.53, r: 0.145, x: 0.74, y: 0.96, yaw: -1, rot: 0.04 },
      { cx: 0.73, cy: 0.75, r: 0.12, x: 0.86, y: 0.93, yaw: 1, rot: 0.1 },
    ].forEach((view) => drawBadgeView(ctx, source, size, { ...view, depth: 0.72, primary: false }, depth, shadow * 0.92, shine * 0.92, options.material, productScale, renderShapeModel));
  } else if (layoutMode === "duo") {
    drawStudioFloor(ctx, size, backgroundItem);
    drawBadgeView(ctx, source, size, { cx: 0.38, cy: 0.54, r: 0.32, depth: 1.18, x: 1, y: 1, yaw: 0, rot: -0.04, primary: true }, depth, shadow, shine, options.material, productScale, renderShapeModel);
    drawBadgeView(ctx, source, size, { cx: 0.72, cy: 0.48, r: 0.22, depth: 0.95, x: 0.58, y: 0.98, yaw: 1, rot: 0.04, primary: false }, depth, shadow, shine, options.material, productScale, renderShapeModel);
  } else if (layoutMode === "triptych") {
    drawBadgeView(ctx, source, size, { cx: 0.28, cy: 0.56, r: 0.19, depth: 0.9, x: 0.74, y: 0.98, yaw: 1, rot: -0.11, primary: false }, depth, shadow, shine, options.material, productScale, renderShapeModel);
    drawBadgeView(ctx, source, size, { cx: 0.50, cy: 0.48, r: 0.25, depth: 1.08, x: 1, y: 1, yaw: 0, rot: 0.02, primary: true }, depth, shadow, shine, options.material, productScale, renderShapeModel);
    drawBadgeView(ctx, source, size, { cx: 0.72, cy: 0.58, r: 0.19, depth: 0.9, x: 0.74, y: 0.98, yaw: -1, rot: 0.13, primary: false }, depth, shadow, shine, options.material, productScale, renderShapeModel);
  } else if (layoutMode === "catalog") {
    drawStudioFloor(ctx, size, backgroundItem);
    [
      { cx: 0.32, cy: 0.34, r: 0.18, x: 1, y: 1, yaw: 0, rot: -0.04, primary: true },
      { cx: 0.68, cy: 0.34, r: 0.18, x: 0.68, y: 0.98, yaw: 1, rot: 0.05, primary: false },
      { cx: 0.32, cy: 0.70, r: 0.18, x: 0.7, y: 0.98, yaw: -1, rot: -0.05, primary: false },
      { cx: 0.68, cy: 0.70, r: 0.18, x: 1, y: 1, yaw: 0, rot: 0.04, primary: true },
    ].forEach((view) => drawBadgeView(ctx, source, size, { ...view, depth: 0.82 }, depth, shadow * 0.82, shine, options.material, productScale, renderShapeModel));
  } else if (layoutMode === "floating") {
    drawBadgeView(ctx, source, size, { cx: 0.45, cy: 0.45, r: 0.29, depth: 1.12, x: 0.92, y: 1, yaw: 0.4, rot: -0.22, primary: true }, depth, shadow, shine, options.material, productScale, renderShapeModel);
    drawBadgeView(ctx, source, size, { cx: 0.68, cy: 0.65, r: 0.17, depth: 0.88, x: 0.7, y: 0.98, yaw: -1, rot: 0.22, primary: false }, depth, shadow * 0.82, shine, options.material, productScale, renderShapeModel);
    drawBadgeView(ctx, source, size, { cx: 0.25, cy: 0.72, r: 0.13, depth: 0.72, x: 0.72, y: 0.98, yaw: 1, rot: -0.28, primary: false }, depth, shadow * 0.72, shine, options.material, productScale, renderShapeModel);
  } else {
    drawBadgeView(ctx, source, size, { cx: 0.50, cy: 0.49, r: 0.36, depth: 1.18, x: 1, y: 1, yaw: 0, rot: -0.03, primary: true }, depth, shadow, shine, options.material, productScale, renderShapeModel);
  }

  drawSpotlight(ctx, size);

  if (options.badge) drawBadge(ctx, size, options.badgeX, options.badgeY, options.badgeSize);

  return await canvasToJpegBlob(canvas);
}

function drawBackground(ctx, size, backgroundItem) {
  if (backgroundItem?.image) {
    drawBackgroundImage(ctx, backgroundItem.image, size, state.options.backgroundFit);
    return;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
}

function drawSpotlight(ctx, size) {
  const strength = clamp(numberOr(state.options.spotlight, 0) / 100, 0, 1);
  if (strength <= 0) return;
  const x = size * (clamp(numberOr(state.options.spotlightX, 38), 0, 100) / 100);
  const y = size * (clamp(numberOr(state.options.spotlightY, 34), 0, 100) / 100);
  const width = size * (clamp(numberOr(state.options.spotlightWidth ?? state.options.spotlightSize, 46), 1, 140) / 100);
  const height = size * (clamp(numberOr(state.options.spotlightHeight ?? state.options.spotlightSize, 46), 1, 140) / 100);
  const rotation = (clamp(numberOr(state.options.spotlightRotation, 0), -180, 180) * Math.PI) / 180;
  const radius = Math.max(width, height) / 2;
  const color = hexToRgb(state.options.spotlightColor || "#ffffff");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(width / Math.max(width, height), height / Math.max(width, height));
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  glow.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.08 + strength * 0.62})`);
  glow.addColorStop(0.28, `rgba(${color.r},${color.g},${color.b},${0.04 + strength * 0.28})`);
  glow.addColorStop(0.62, `rgba(${color.r},${color.g},${color.b},${0.012 + strength * 0.08})`);
  glow.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawBackgroundPhotoWash(ctx, size, key) {
  ctx.save();
  const wash = ctx.createRadialGradient(size * 0.44, size * 0.46, size * 0.05, size * 0.5, size * 0.52, size * 0.7);
  const bright = ["light-blue-silk", "crumpled-blue-silk", "white-silk-drapery", "soft-paper-cards", "cream-pastel-swirl"];
  wash.addColorStop(0, bright.includes(key) ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.18)");
  wash.addColorStop(0.58, bright.includes(key) ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.32)");
  wash.addColorStop(1, bright.includes(key) ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.46)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);

  const vignette = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.2, size * 0.5, size * 0.5, size * 0.76);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawAmbientLight(ctx, size, dark = false) {
  ctx.save();
  const glow = ctx.createRadialGradient(size * 0.42, size * 0.42, size * 0.05, size * 0.42, size * 0.42, size * 0.66);
  glow.addColorStop(0, dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.72)");
  glow.addColorStop(0.55, dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawBackgroundImage(ctx, image, size, fit) {
  if (fit === "blurCover") {
    ctx.save();
    ctx.filter = `blur(${Math.round(size * 0.018)}px)`;
    drawImageFitted(ctx, image, -size * 0.04, -size * 0.04, size * 1.08, size * 1.08, "cover");
    ctx.restore();
    ctx.save();
    drawImageFitted(ctx, image, size * 0.08, size * 0.08, size * 0.84, size * 0.84, "contain");
    ctx.restore();
    return;
  }
  drawImageFitted(ctx, image, 0, 0, size, size, fit);
}

function drawImageFitted(ctx, image, x, y, w, h, fit) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = fit === "contain" ? Math.min(w / image.width, h / image.height) : Math.max(w / image.width, h / image.height);
  const iw = image.width * scale;
  const ih = image.height * scale;
  ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function drawBackgroundWash(ctx, size) {
  ctx.save();
  const wash = ctx.createRadialGradient(size * 0.42, size * 0.45, size * 0.12, size * 0.5, size * 0.5, size * 0.68);
  wash.addColorStop(0, "rgba(255,255,255,0.18)");
  wash.addColorStop(0.58, "rgba(255,255,255,0.38)");
  wash.addColorStop(1, "rgba(255,255,255,0.62)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawBackgroundPattern(ctx, size, scene) {
  if (scene === "none") return;
  ctx.save();
  if (scene === "softGeometry") {
    ctx.globalAlpha = 0.55;
    drawBlob(ctx, size * 0.16, size * 0.17, size * 0.13, "#9dc8bc");
    drawBlob(ctx, size * 0.87, size * 0.18, size * 0.11, "#f1c27d");
    drawBlob(ctx, size * 0.84, size * 0.84, size * 0.18, "#d9b1c5");
    ctx.strokeStyle = "rgba(31,94,82,0.16)";
    ctx.lineWidth = size * 0.006;
    ctx.strokeRect(size * 0.075, size * 0.075, size * 0.85, size * 0.85);
  } else if (scene === "editorialShapes") {
    ctx.globalAlpha = 0.55;
    drawRoundedRect(ctx, size * 0.08, size * 0.12, size * 0.34, size * 0.18, size * 0.035, "#d9ece4");
    drawRoundedRect(ctx, size * 0.67, size * 0.08, size * 0.22, size * 0.34, size * 0.04, "#f4d7b2");
    drawRoundedRect(ctx, size * 0.62, size * 0.72, size * 0.3, size * 0.16, size * 0.035, "#e2d8ef");
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#26312c";
    ctx.beginPath();
    ctx.arc(size * 0.18, size * 0.76, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (scene === "glassCards") {
    drawGlassPanel(ctx, size * 0.08, size * 0.12, size * 0.36, size * 0.48, size * 0.035);
    drawGlassPanel(ctx, size * 0.58, size * 0.18, size * 0.32, size * 0.28, size * 0.035);
    drawGlassPanel(ctx, size * 0.55, size * 0.62, size * 0.34, size * 0.22, size * 0.035);
  } else if (scene === "displayGrid") {
    ctx.strokeStyle = "rgba(35,48,44,0.08)";
    ctx.lineWidth = 1;
    for (let p = size * 0.08; p < size * 0.95; p += size * 0.07) {
      ctx.beginPath();
      ctx.moveTo(p, size * 0.1);
      ctx.lineTo(p, size * 0.92);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.08, p);
      ctx.lineTo(size * 0.94, p);
      ctx.stroke();
    }
  } else if (scene === "halo") {
    for (let i = 0; i < 5; i += 1) {
      ctx.strokeStyle = `rgba(31,94,82,${0.13 - i * 0.018})`;
      ctx.lineWidth = size * 0.012;
      ctx.beginPath();
      ctx.arc(size * 0.43, size * 0.5, size * (0.22 + i * 0.075), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (scene === "auraRings") {
    const colors = ["#f3c1a4", "#9dc8bc", "#c9bddf", "#f1df9d"];
    for (let i = 0; i < 8; i += 1) {
      ctx.strokeStyle = hexToRgba(colors[i % colors.length], 0.16 - i * 0.012);
      ctx.lineWidth = size * (0.018 - i * 0.001);
      ctx.beginPath();
      ctx.ellipse(size * 0.45, size * 0.52, size * (0.24 + i * 0.052), size * (0.14 + i * 0.034), -0.22, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (scene === "waves") {
    ctx.strokeStyle = "rgba(31,94,82,0.14)";
    ctx.lineWidth = size * 0.012;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      const y = size * (0.13 + i * 0.14);
      ctx.moveTo(-size * 0.05, y);
      ctx.bezierCurveTo(size * 0.22, y - size * 0.12, size * 0.42, y + size * 0.12, size * 0.7, y);
      ctx.bezierCurveTo(size * 0.9, y - size * 0.08, size * 1.04, y + size * 0.03, size * 1.1, y);
      ctx.stroke();
    }
  } else if (scene === "silk") {
    for (let i = 0; i < 7; i += 1) {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, `rgba(255,255,255,${0.24 - i * 0.012})`);
      g.addColorStop(0.5, `rgba(157,200,188,${0.12 - i * 0.01})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = size * (0.055 - i * 0.004);
      ctx.beginPath();
      ctx.moveTo(-size * 0.12, size * (0.28 + i * 0.08));
      ctx.bezierCurveTo(size * 0.28, size * (0.08 + i * 0.02), size * 0.62, size * (0.58 + i * 0.04), size * 1.1, size * (0.36 + i * 0.08));
      ctx.stroke();
    }
  } else if (scene === "sunburst") {
    ctx.translate(size * 0.45, size * 0.48);
    for (let i = 0; i < 42; i += 1) {
      ctx.rotate((Math.PI * 2) / 42);
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.13)" : "rgba(31,94,82,0.035)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size * 0.9, -size * 0.012);
      ctx.lineTo(size * 0.9, size * 0.012);
      ctx.closePath();
      ctx.fill();
    }
  } else if (scene === "diagonal") {
    ctx.globalAlpha = 0.44;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, size * 0.22);
    ctx.lineTo(size, 0);
    ctx.lineTo(size, size * 0.2);
    ctx.lineTo(0, size * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(31,94,82,0.09)";
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size);
    ctx.lineTo(size, size * 0.66);
    ctx.lineTo(size, size);
    ctx.closePath();
    ctx.fill();
  } else if (scene === "checkerSoft") {
    const cell = size * 0.095;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        if ((Math.round(x / cell) + Math.round(y / cell)) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }
  } else if (scene === "terrazzo") {
    const colors = ["#9dc8bc", "#f1c27d", "#d9b1c5", "#7f9fb1", "#f5ead2"];
    for (let i = 0; i < 95; i += 1) {
      ctx.save();
      ctx.translate(rand(i, 1) * size, rand(i, 2) * size);
      ctx.rotate(rand(i, 3) * Math.PI);
      ctx.globalAlpha = 0.2 + rand(i, 4) * 0.22;
      ctx.fillStyle = colors[i % colors.length];
      drawShard(ctx, size * (0.008 + rand(i, 5) * 0.022));
      ctx.restore();
    }
  } else if (scene === "confetti") {
    const colors = ["#1f5e52", "#f1c27d", "#d9b1c5", "#8ab6d6"];
    for (let i = 0; i < 140; i += 1) {
      ctx.save();
      ctx.translate(rand(i, 1) * size, rand(i, 2) * size);
      ctx.rotate(rand(i, 3) * Math.PI);
      ctx.globalAlpha = 0.14 + rand(i, 4) * 0.18;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(0, 0, size * (0.005 + rand(i, 5) * 0.012), size * 0.004);
      ctx.restore();
    }
  } else if (scene === "paper") {
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 900; i += 1) {
      const v = 190 + rand(i, 1) * 55;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(rand(i, 2) * size, rand(i, 3) * size, 1, 1);
    }
  } else if (scene === "topographic") {
    ctx.strokeStyle = "rgba(31,94,82,0.1)";
    ctx.lineWidth = size * 0.004;
    for (let i = 0; i < 11; i += 1) {
      ctx.beginPath();
      const y = size * (0.12 + i * 0.075);
      ctx.moveTo(size * 0.06, y);
      for (let x = size * 0.06; x <= size * 0.96; x += size * 0.08) {
        ctx.lineTo(x, y + Math.sin(i * 1.3 + (x / size) * 8) * size * 0.022);
      }
      ctx.stroke();
    }
  } else if (scene === "boutique") {
    drawRoundedRect(ctx, size * 0.18, size * 0.2, size * 0.64, size * 0.56, size * 0.03, "rgba(255,255,255,0.22)");
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = size * 0.006;
    ctx.strokeRect(size * 0.18, size * 0.2, size * 0.64, size * 0.56);
    ctx.fillStyle = "rgba(31,94,82,0.08)";
    ctx.fillRect(size * 0.08, size * 0.78, size * 0.84, size * 0.06);
  }
  ctx.restore();
}

function drawBlob(ctx, x, y, radius, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoundedRect(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

function drawGlassPanel(ctx, x, y, w, h, r) {
  ctx.save();
  ctx.shadowColor = "rgba(40,48,44,0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, x, y, w, h, r, "rgba(255,255,255,0.26)");
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + r * 0.35, y + r * 0.35, w - r * 0.7, h - r * 0.7);
  ctx.restore();
}

function drawShard(ctx, scale) {
  ctx.beginPath();
  ctx.moveTo(0, -scale);
  ctx.lineTo(scale * 0.9, -scale * 0.2);
  ctx.lineTo(scale * 0.5, scale);
  ctx.lineTo(-scale * 0.7, scale * 0.55);
  ctx.closePath();
  ctx.fill();
}

function rand(a, b) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function hexToRgba(hex, alpha) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function tint(color, amount) {
  return {
    r: Math.round(color.r + (255 - color.r) * amount),
    g: Math.round(color.g + (255 - color.g) * amount),
    b: Math.round(color.b + (255 - color.b) * amount),
  };
}

function shadeColor(color, amount) {
  return {
    r: Math.round(color.r * (1 - amount)),
    g: Math.round(color.g * (1 - amount)),
    b: Math.round(color.b * (1 - amount)),
  };
}

function rgbString(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function drawStudioFloor(ctx, size, backgroundItem) {
  if (!backgroundItem?.image) return;
  ctx.save();
  const floor = ctx.createLinearGradient(0, size * 0.44, 0, size);
  floor.addColorStop(0, "rgba(255,255,255,0)");
  floor.addColorStop(1, "rgba(126,135,130,0.10)");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawBadgeView(ctx, source, size, view, depth, shadow, shine, material, productScale, shapeModel = { shape: "circle", sides: 6, x: 1, y: 1 }) {
  const lighting = getLightingOptions();
  drawProductView(ctx, source, {
    cx: size * view.cx,
    cy: size * view.cy,
    radius: size * view.r * productScale,
    depth: depth * view.depth * productScale,
    xScale: view.x,
    yScale: view.y * (1 - lighting.tilt * 0.2),
    yaw: view.yaw,
    pitch: (view.pitch || 0) + lighting.tilt * 0.58,
    rotation: shapeModel.fixedRotation ? 0 : view.rot,
    shadow,
    shine,
    material,
    edgeColor: state.options.edgeColor,
    primary: view.primary,
    shape: shapeModel.shape,
    sides: shapeModel.sides,
    shapeX: shapeModel.x,
    shapeY: shapeModel.y,
  });
}

function productBounds(view, inset = 0) {
  const shapeX = Number.isFinite(view.shapeX) ? view.shapeX : 1;
  const shapeY = Number.isFinite(view.shapeY) ? view.shapeY : 1;
  return {
    rx: Math.max(0, view.radius * shapeX - inset),
    ry: Math.max(0, view.radius * shapeY - inset),
  };
}

function isRoundProductShape(view) {
  return view.shape === "circle" || view.shape === "ellipse";
}

function traceProductShape(ctx, view, inset = 0) {
  const { rx, ry } = productBounds(view, inset);
  if (rx <= 0 || ry <= 0) return;
  if (view.shape === "rectangle") {
    ctx.rect(-rx, -ry, rx * 2, ry * 2);
    return;
  }
  if (view.shape === "polygon") {
    const sides = Math.round(clamp(view.sides || 6, 3, 12));
    if (sides === 4) {
      ctx.rect(-rx, -ry, rx * 2, ry * 2);
      return;
    }
    const startAngle = regularPolygonStartAngle(sides);
    for (let i = 0; i < sides; i += 1) {
      const angle = startAngle + (i / sides) * Math.PI * 2;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return;
  }
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
}

function traceRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawProductView(ctx, image, view) {
  drawCastShadow(ctx, view);
  drawReflection(ctx, view);
  drawBackRimLight(ctx, view);
  drawExtrudedEdge(ctx, view);
  drawFace(ctx, image, view);
  drawDirectionalLight(ctx, view);
  drawMaterialFinish(ctx, view);
  drawGlareStripe(ctx, view);
  drawPinRim(ctx, view);
  drawSpecularEdge(ctx, view);
}

function drawSpecularEdge(ctx, view) {
  const { radius, shine } = view;
  withProductTransform(ctx, view, () => {
    ctx.save();
    ctx.globalAlpha = Math.min(0.24, 0.08 + shine * 0.22);
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = Math.max(1.5, radius * 0.01);
    let bounds = productBounds(view, ctx.lineWidth * 0.9);
    ctx.beginPath();
    if (isRoundProductShape(view)) {
      ctx.ellipse(0, 0, bounds.rx, bounds.ry, 0, Math.PI * 1.12, Math.PI * 1.55);
    } else {
      traceProductShape(ctx, view, ctx.lineWidth * 0.9);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    bounds = productBounds(view, ctx.lineWidth);
    ctx.beginPath();
    if (isRoundProductShape(view)) {
      ctx.ellipse(0, 0, bounds.rx, bounds.ry, 0, Math.PI * 0.16, Math.PI * 0.48);
    } else {
      traceProductShape(ctx, view, ctx.lineWidth);
    }
    ctx.stroke();
    ctx.restore();
  });
}

function withProductTransform(ctx, view, fn) {
  ctx.save();
  ctx.translate(view.cx, view.cy);
  ctx.rotate(view.rotation);
  ctx.scale(view.xScale, view.yScale);
  fn();
  ctx.restore();
}

function drawCastShadow(ctx, view) {
  const { cx, cy, radius, depth, shadow, xScale, yScale, yaw, shapeX, shapeY } = view;
  if (shadow <= 0) return;
  const yawValue = Number.isFinite(yaw) ? yaw : 0;
  const pitch = Number.isFinite(view.pitch) ? view.pitch : 0;
  const yawDirection = yawValue < -0.01 ? -1 : 1;
  const widthScale = Number.isFinite(shapeX) ? shapeX : 1;
  const heightScale = Number.isFinite(shapeY) ? shapeY : 1;
  ctx.save();
  ctx.globalAlpha = 0.72 * shadow;
  ctx.filter = `blur(${Math.max(18, depth * 1.35)}px)`;
  ctx.fillStyle = "rgba(32,38,36,0.72)";
  ctx.beginPath();
  ctx.ellipse(
    cx + depth * yawDirection * (1.1 + Math.abs(yawValue) * 0.22),
    cy + radius * (0.64 + Math.max(0, pitch) * 0.08 - Math.max(0, -pitch) * 0.12) + depth * (0.46 + Math.abs(pitch) * 0.18),
    radius * (0.86 * xScale * widthScale + 0.12),
    radius * (0.16 * yScale * heightScale) + depth * 0.42,
    view.rotation,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function drawReflection(ctx, view) {
  if (!view.primary) return;
  const { rx, ry } = productBounds(view);
  const lighting = getLightingOptions();
  if (lighting.reflection <= 0) return;
  ctx.save();
  const fade = ctx.createLinearGradient(0, view.cy + ry * 0.55, 0, view.cy + ry * 1.2);
  fade.addColorStop(0, `rgba(255,255,255,${0.12 + lighting.reflection * 0.36})`);
  fade.addColorStop(0.36, `rgba(255,255,255,${0.04 + lighting.reflection * 0.16})`);
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fade;
  ctx.beginPath();
  ctx.ellipse(
    view.cx + view.depth * 0.8,
    view.cy + ry * 0.82,
    rx * 0.78,
    ry * 0.12,
    view.rotation,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
}

function getLightingOptions() {
  return {
    angle: (clamp(numberOr(state.options.lightAngle, -42), -180, 180) * Math.PI) / 180,
    strength: clamp(numberOr(state.options.lightStrength, 64) / 100, 0, 1),
    reflection: clamp(numberOr(state.options.reflection, 42) / 100, 0, 1),
    rim: clamp(numberOr(state.options.rimLight, 58) / 100, 0, 1),
    glare: clamp(numberOr(state.options.glare, 62) / 100, 0, 1),
    tilt: clamp(numberOr(state.options.viewTilt, 24) / 100, 0, 1),
  };
}

function drawLocalLightingOverlay(ctx, x, y, width, height, shapeScale = 1) {
  const lighting = getLightingOptions();
  if (lighting.strength <= 0) return;
  const dx = Math.cos(lighting.angle);
  const dy = Math.sin(lighting.angle);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const span = Math.max(width, height) * shapeScale;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const highlight = ctx.createLinearGradient(cx - dx * span, cy - dy * span, cx + dx * span, cy + dy * span);
  highlight.addColorStop(0, `rgba(255,255,255,${0.05 + lighting.strength * 0.24})`);
  highlight.addColorStop(0.32, `rgba(255,255,255,${0.015 + lighting.strength * 0.08})`);
  highlight.addColorStop(0.62, "rgba(255,255,255,0)");
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = highlight;
  ctx.fillRect(x, y, width, height);
  ctx.globalCompositeOperation = "multiply";
  const shade = ctx.createLinearGradient(cx - dx * span, cy - dy * span, cx + dx * span, cy + dy * span);
  shade.addColorStop(0, "rgba(255,255,255,1)");
  shade.addColorStop(0.58, "rgba(255,255,255,1)");
  shade.addColorStop(1, `rgba(0,0,0,${0.06 + lighting.strength * 0.18})`);
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, width, height);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function drawLocalGlareStripe(ctx, x, y, width, height, shapeScale = 1) {
  const lighting = getLightingOptions();
  if (lighting.glare <= 0) return;
  const stripeAngle = lighting.angle + Math.PI / 2.8;
  const dx = Math.cos(stripeAngle);
  const dy = Math.sin(stripeAngle);
  const cx = x + width / 2;
  const cy = y + height / 2;
  const span = Math.max(width, height) * shapeScale;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const stripe = ctx.createLinearGradient(cx - dx * span, cy - dy * span, cx + dx * span, cy + dy * span);
  stripe.addColorStop(0, "rgba(255,255,255,0)");
  stripe.addColorStop(0.42, "rgba(255,255,255,0)");
  stripe.addColorStop(0.49, `rgba(255,255,255,${0.08 + lighting.glare * 0.42})`);
  stripe.addColorStop(0.53, `rgba(255,255,255,${0.04 + lighting.glare * 0.24})`);
  stripe.addColorStop(0.62, "rgba(255,255,255,0)");
  stripe.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = stripe;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawDirectionalLight(ctx, view) {
  const { rx, ry } = productBounds(view);
  withProductTransform(ctx, view, () => {
    ctx.save();
    ctx.beginPath();
    traceProductShape(ctx, view);
    ctx.clip();
    drawLocalLightingOverlay(ctx, -rx, -ry, rx * 2, ry * 2, 1.05);
    ctx.restore();
  });
}

function drawBackRimLight(ctx, view) {
  const lighting = getLightingOptions();
  if (lighting.rim <= 0) return;
  const { radius } = view;
  const dx = Math.cos(lighting.angle);
  const dy = Math.sin(lighting.angle);
  withProductTransform(ctx, view, () => {
    ctx.save();
    ctx.translate((-dx * radius * 0.035) / Math.max(0.001, view.xScale), (-dy * radius * 0.035) / Math.max(0.001, view.yScale));
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = `rgba(255,255,255,${0.35 + lighting.rim * 0.45})`;
    ctx.shadowBlur = Math.max(12, radius * (0.09 + lighting.rim * 0.08));
    ctx.strokeStyle = `rgba(255,255,255,${0.16 + lighting.rim * 0.42})`;
    ctx.lineWidth = Math.max(4, radius * (0.018 + lighting.rim * 0.02));
    ctx.beginPath();
    traceProductShape(ctx, view, -ctx.lineWidth * 0.1);
    ctx.stroke();
    ctx.restore();
  });
}

function drawGlareStripe(ctx, view) {
  const { rx, ry } = productBounds(view);
  withProductTransform(ctx, view, () => {
    ctx.save();
    ctx.beginPath();
    traceProductShape(ctx, view);
    ctx.clip();
    drawLocalGlareStripe(ctx, -rx, -ry, rx * 2, ry * 2, 1.14);
    ctx.restore();
  });
}

function drawExtrudedEdge(ctx, view) {
  const { radius, depth, yaw, material, edgeColor } = view;
  if (depth <= 0.5) return;
  const yawValue = Number.isFinite(yaw) ? yaw : 0;
  const pitch = Number.isFinite(view.pitch) ? view.pitch : 0;
  const yawDirection = yawValue < -0.01 ? -1 : 1;
  const base = hexToRgb(edgeColor || "#8f9188");
  const layers = Math.max(38, Math.round(depth * 1.55));
  for (let i = layers; i >= 0; i -= 1) {
    const t = i / layers;
    const offsetX = depth * t * yawDirection * (1.02 + Math.abs(yawValue) * 0.78);
    const offsetY = depth * t * (0.76 + Math.abs(pitch) * 0.36) * (pitch < 0 ? -0.72 : 1);
    const alpha = material === "acrylic" ? 0.7 + 0.28 * (1 - t) : 0.76 + 0.2 * (1 - t);
    ctx.save();
    ctx.globalAlpha = alpha;
    withProductTransform(ctx, view, () => {
      ctx.translate(offsetX / Math.max(0.001, view.xScale), offsetY / Math.max(0.001, view.yScale));
      const edge = ctx.createLinearGradient(-radius, -radius, radius, radius);
      if (material === "metal") {
        edge.addColorStop(0, rgbString(tint(base, 0.42)));
        edge.addColorStop(0.36, rgbString(shadeColor(base, 0.18)));
        edge.addColorStop(0.7, rgbString(tint(base, 0.36)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.42)));
      } else {
        edge.addColorStop(0, rgbString(tint(base, 0.5)));
        edge.addColorStop(0.32, rgbString(tint(base, 0.12)));
        edge.addColorStop(0.62, rgbString(shadeColor(base, 0.16)));
        edge.addColorStop(1, rgbString(shadeColor(base, 0.52)));
      }
      ctx.fillStyle = edge;
      ctx.beginPath();
      traceProductShape(ctx, view);
      ctx.fill();
      ctx.globalAlpha = 0.32 * (1 - t);
      ctx.strokeStyle = "rgba(255,255,255,0.86)";
      ctx.lineWidth = Math.max(1.5, radius * 0.008);
      ctx.beginPath();
      if (isRoundProductShape(view)) {
        const bounds = productBounds(view, ctx.lineWidth);
        ctx.ellipse(0, 0, bounds.rx, bounds.ry, 0, Math.PI * 1.05, Math.PI * 1.62);
      } else {
        traceProductShape(ctx, view, ctx.lineWidth);
      }
      ctx.stroke();
    });
    ctx.restore();
  }
}

function drawFace(ctx, image, view) {
  const { radius } = view;
  withProductTransform(ctx, view, () => {
    ctx.save();
    const { rx, ry } = productBounds(view);
    ctx.beginPath();
    traceProductShape(ctx, view);
    ctx.clip();

    const targetWidth = rx * 2;
    const targetHeight = ry * 2;
    const sourceRect = getFullImageRect(image);
    ctx.filter = "saturate(1.28) contrast(1.08) brightness(1.04)";
    ctx.drawImage(image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
    ctx.filter = "none";

    const shade = ctx.createLinearGradient(-rx, -ry, rx, ry);
    shade.addColorStop(0, "rgba(255,255,255,0.07)");
    shade.addColorStop(0.52, "rgba(255,255,255,0)");
    shade.addColorStop(0.82, "rgba(0,0,0,0.035)");
    shade.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = shade;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.restore();
  });
}

function drawMaterialFinish(ctx, view) {
  const { radius, shine, material } = view;
  withProductTransform(ctx, view, () => {
    ctx.save();
    const { rx, ry } = productBounds(view);
    const roundedShape = isRoundProductShape(view);
    ctx.beginPath();
    traceProductShape(ctx, view);
    ctx.clip();

    if (material === "acrylic") {
      if (roundedShape) {
        const dome = ctx.createRadialGradient(-radius * 0.28, -radius * 0.46, radius * 0.08, 0, 0, radius);
        dome.addColorStop(0, `rgba(255,255,255,${0.1 + shine * 0.1})`);
        dome.addColorStop(0.38, `rgba(255,255,255,${0.025 + shine * 0.035})`);
        dome.addColorStop(0.72, "rgba(255,255,255,0)");
        dome.addColorStop(1, "rgba(0,0,0,0.055)");
        ctx.fillStyle = dome;
        ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
      } else {
        const surface = ctx.createLinearGradient(-rx, -ry, rx, ry);
        surface.addColorStop(0, `rgba(255,255,255,${0.12 + shine * 0.08})`);
        surface.addColorStop(0.34, `rgba(255,255,255,${0.035 + shine * 0.03})`);
        surface.addColorStop(0.72, "rgba(255,255,255,0)");
        surface.addColorStop(1, "rgba(0,0,0,0.06)");
        ctx.fillStyle = surface;
        ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

        ctx.globalAlpha = Math.min(0.18, 0.05 + shine * 0.16);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.beginPath();
        ctx.moveTo(-rx * 0.92, -ry * 0.54);
        ctx.lineTo(-rx * 0.68, -ry * 0.84);
        ctx.lineTo(rx * 0.94, ry * 0.16);
        ctx.lineTo(rx * 0.72, ry * 0.44);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const lowerShade = ctx.createLinearGradient(0, -ry, 0, ry);
      lowerShade.addColorStop(0, "rgba(255,255,255,0)");
      lowerShade.addColorStop(0.72, "rgba(0,0,0,0.01)");
      lowerShade.addColorStop(1, "rgba(0,0,0,0.085)");
      ctx.fillStyle = lowerShade;
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

      if (roundedShape && shine > 0.62) {
        ctx.globalAlpha = Math.min(0.22, (shine - 0.58) * 0.62);
        ctx.fillStyle = "rgba(255,255,255,0.68)";
        ctx.beginPath();
        ctx.ellipse(-radius * 0.48, -radius * 0.36, radius * 0.2, radius * 0.58, -0.72, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (material === "metal") {
      ctx.globalAlpha = shine * 0.42;
      const metal = ctx.createLinearGradient(-radius, 0, radius, 0);
      metal.addColorStop(0, "rgba(255,255,255,0.3)");
      metal.addColorStop(0.22, "rgba(0,0,0,0.035)");
      metal.addColorStop(0.48, "rgba(255,255,255,0.18)");
      metal.addColorStop(0.72, "rgba(0,0,0,0.045)");
      metal.addColorStop(1, "rgba(255,255,255,0.12)");
      ctx.fillStyle = metal;
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    } else {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ffffff";
      for (let y = -ry; y < ry; y += Math.max(1, radius * 0.06)) {
        ctx.fillRect(-rx, y, rx * 2, 1);
      }
    }

    ctx.restore();
  });
}

function drawPinRim(ctx, view) {
  const { radius, material } = view;
  withProductTransform(ctx, view, () => {
    ctx.save();
    const { rx, ry } = productBounds(view);
    const roundedShape = isRoundProductShape(view);
    ctx.lineWidth = Math.max(5, radius * 0.045);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    traceProductShape(ctx, view, -ctx.lineWidth * 0.12);
    ctx.stroke();

    const rim = roundedShape ? ctx.createRadialGradient(-radius * 0.34, -radius * 0.44, radius * 0.2, 0, 0, radius) : ctx.createLinearGradient(-rx, -ry, rx, ry);
    if (roundedShape) {
      rim.addColorStop(0, "rgba(255,255,255,0.12)");
      rim.addColorStop(0.74, "rgba(255,255,255,0)");
      rim.addColorStop(0.9, material === "metal" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.055)");
      rim.addColorStop(1, "rgba(0,0,0,0.14)");
    } else {
      rim.addColorStop(0, "rgba(255,255,255,0.10)");
      rim.addColorStop(0.36, "rgba(255,255,255,0.02)");
      rim.addColorStop(0.74, "rgba(0,0,0,0.025)");
      rim.addColorStop(1, "rgba(0,0,0,0.13)");
    }
    ctx.fillStyle = rim;
    ctx.beginPath();
    traceProductShape(ctx, view);
    ctx.fill();

    ctx.lineWidth = Math.max(5, radius * 0.04);
    ctx.strokeStyle = material === "metal" ? "rgba(245,238,218,0.48)" : "rgba(255,255,255,0.24)";
    ctx.beginPath();
    traceProductShape(ctx, view, ctx.lineWidth / 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.5, radius * 0.012);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    traceProductShape(ctx, view, 1);
    ctx.stroke();

    ctx.lineWidth = Math.max(2, radius * 0.01);
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.beginPath();
    if (isRoundProductShape(view)) {
      const bounds = productBounds(view, ctx.lineWidth * 1.4);
      ctx.ellipse(0, 0, bounds.rx, bounds.ry, 0, Math.PI * 1.05, Math.PI * 1.68);
    } else {
      traceProductShape(ctx, view, ctx.lineWidth * 1.4);
    }
    ctx.stroke();
    ctx.restore();
  });
}

function drawBadge(ctx, size, xPercent = 89.5, yPercent = 9.5, badgeSize = 100) {
  const badgeOptions = { badgeSize, badgeX: xPercent, badgeY: yPercent };
  normalizeBadgePosition(badgeOptions);
  const x = size * (badgeOptions.badgeX / 100);
  const y = size * (badgeOptions.badgeY / 100);
  const r = size * (badgeRadiusPercent(badgeOptions) / 100);
  drawBadgeShape(ctx, x, y, r, size);
}

function drawBadgeShape(ctx, x, y, r, size) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowColor = "rgba(0,0,0,0.32)";
  ctx.shadowBlur = r * (BADGE_SHADOW_BLUR_PERCENT / DEFAULT_BADGE_RADIUS_PERCENT);
  ctx.shadowOffsetY = r * (BADGE_SHADOW_OFFSET_PERCENT / DEFAULT_BADGE_RADIUS_PERCENT);

  ctx.fillStyle = "#ffe600";
  ctx.beginPath();
  ctx.arc(x, y, r * 1.18, 0, Math.PI * 2);
  ctx.fill();

  const sticker = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.08, x, y, r);
  sticker.addColorStop(0, "#ff5bd7");
  sticker.addColorStop(0.48, "#ff174c");
  sticker.addColorStop(1, "#bd0037");
  ctx.fillStyle = sticker;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(1, r * 0.103);
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.24, y - r * 0.36, r * 0.32, r * 0.16, -0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(0.5, r * 0.052);
  ctx.strokeStyle = "rgba(80,0,35,0.5)";
  ctx.font = `900 ${Math.round(r * 0.448)}px Arial, sans-serif`;
  ctx.strokeText("2D", x, y - r * 0.24);
  ctx.fillText("2D", x, y - r * 0.22);
  ctx.font = `900 ${Math.round(r * 0.345)}px Arial, sans-serif`;
  ctx.strokeText("FLAT", x, y + r * 0.28);
  ctx.fillText("FLAT", x, y + r * 0.28);
  ctx.restore();
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function canvasToJpegBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas 导出 JPEG 失败"));
      },
      "image/jpeg",
      OUTPUT_JPEG_QUALITY,
    );
  });
}

function releaseDecodedImage(image) {
  if (image && typeof image.close === "function") image.close();
}

function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

async function loadImage(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
      // Fall back to HTMLImageElement for formats or browsers that reject ImageBitmap.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function safeName(value) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 48);
}

function outputName(file, backgroundItem) {
  const stem = file.name.replace(/\.[^.]+$/, "");
  return `${stem}-${safeName(backgroundItem.name)}-3d.jpg`;
}

function updateProgress(done, total) {
  document.querySelector("#statusTitle").textContent = `正在处理 ${done} / ${total}`;
  document.querySelector("#countPill").textContent = `${total} 张图片`;
  paintFileList(done);
  paintProductFileList();
}

function updateUi(status) {
  const hasFiles = hasProductFiles();
  const selectedCount = getSelectedProductItems().length;
  const hasShape = hasSelectedProductShape();
  const waitingForShape = hasFiles && !hasShape;
  const productUploadLocked = state.processing;
  const controlsLocked = !hasFiles || waitingForShape || state.processing;
  const total = selectedCount * getActiveBackgroundPresets().length;
  const downloadReady = validateRenderedForDownload().ready;
  document.querySelector("#renderBtn").disabled = !selectedCount || !hasShape || !getActiveBackgroundPresets().length || controlsLocked;
  document.querySelector("#clearRenderedBtn").disabled = !state.rendered.length || controlsLocked;
  document.querySelector("#downloadBtn").disabled = !downloadReady || controlsLocked;
  ["productInput", "folderInput"].forEach((id) => {
    const control = document.querySelector(`#${id}`);
    if (control) control.disabled = productUploadLocked;
  });
  ["backgroundUpload", "backgroundFolderUpload", "size", "adjustOutputSize", "depth", "lightAngle", "lightStrength", "glare", "viewTilt", "spotlight", "badge", "badgeSize"].forEach((id) => {
    const control = document.querySelector(`#${id}`);
    if (control) control.disabled = controlsLocked;
  });
  document.querySelector("#productUploadField")?.classList.toggle("field--disabled", productUploadLocked);
  document.querySelector("#backgroundUploadField")?.classList.toggle("field--disabled", controlsLocked);
  document.querySelector(".render-controls--left")?.classList.toggle("field--disabled", controlsLocked);
  document.querySelector(".render-actions-panel")?.classList.toggle("field--disabled", controlsLocked);
  document.querySelector("#statusTitle").textContent =
    status || (hasFiles ? (hasShape ? (selectedCount ? "已上传图片，可以生成" : "请至少勾选一张上传图片") : "已上传图片，请先选择图片形状") : "等待上传图片");
  document.querySelector("#countPill").textContent = `${total} 张成品`;
  if (state.viewMode !== "result") document.querySelector("#previewModeLabel").textContent = "实时预览";
  document.querySelector("#renderBtn").innerHTML = state.processing
    ? `<span data-icon="loader" class="spin"></span> 正在生成`
    : `<span data-icon="sparkles"></span> 生成 3D 效果`;
  renderIcons();
  paintBackgroundLibrary();
  paintProductFileList();
  syncOptionLabels();
  syncOutputSizeControl();
  syncProductShapeControl();
  paintFileList(state.rendered.length);
}

function paintBackgroundLibrary() {
  const library = document.querySelector("#backgroundLibrary");
  if (!library) return;
  const locked = !hasProductFiles() || isWaitingForProductShape() || state.processing;
  if (!state.userBackgrounds.length) {
    library.innerHTML = `<p class="muted">${!hasProductFiles() ? "请先上传产品图片，再上传或配置背景。" : isWaitingForProductShape() ? "请先选择图片形状，再上传或配置背景。" : "还没有上传背景。可以上传单张，也可以上传一个背景文件夹。"}</p>`;
    return;
  }

  library.innerHTML = state.userBackgrounds
    .map((background, index) => {
      const isFocused = background.id === state.activeBackgroundId;
      background.layoutMode = "free";
      return `
        <div class="background-row ${isFocused ? "background-row--active" : ""} ${locked ? "background-row--disabled" : ""}" data-background-id="${background.id}">
          <label class="background-check">
            <input type="checkbox" ${background.selected ? "checked" : ""} ${locked ? "disabled" : ""} />
            <img src="${background.url}" alt="${background.name}" />
          </label>
          <input class="background-name" type="text" value="${escapeHtml(background.name)}" aria-label="Background ${index + 1} name" ${locked ? "disabled" : ""} />
          <button class="remove-background" title="删除背景" type="button" ${locked ? "disabled" : ""}>×</button>
        </div>
      `;
    })
    .join("");
  library.querySelectorAll(".background-row").forEach((row) => {
    const id = row.dataset.backgroundId;
    const item = state.userBackgrounds.find((background) => background.id === id);
    row.addEventListener("click", (event) => {
      if (locked) return;
      if (event.target.closest(".background-check, .background-name, .remove-background")) return;
      if (state.activeBackgroundId === id) return;
      setFocusedBackground(id);
      paintBackgroundLibrary();
      renderPreview();
    });
    row.querySelector("input[type='checkbox']").addEventListener("change", (event) => {
      if (locked) return;
      setFocusedBackground(id);
      item.selected = event.target.checked;
      clearRendered();
      updateUi("背景选择已更新，可以重新生成");
      renderPreview();
    });
    row.querySelector(".background-name").addEventListener("focus", () => {
      if (locked) return;
      setFocusedBackground(id);
      row.classList.add("background-row--active");
    });
    row.querySelector(".background-name").addEventListener("input", (event) => {
      if (locked) return;
      item.name = event.target.value.trim() || "未命名背景";
      clearRendered();
      updateUi("背景名称已更新，可以重新生成");
    });
    row.querySelector(".remove-background").addEventListener("click", () => {
      if (locked) return;
      if (item.url) URL.revokeObjectURL(item.url);
      const wasFocused = state.activeBackgroundId === id;
      releaseDecodedImage(item.image);
      state.userBackgrounds = state.userBackgrounds.filter((background) => background.id !== id);
      if (wasFocused) state.activeBackgroundId = state.userBackgrounds[0]?.id || null;
      clearRendered();
      updateUi("背景已删除");
      renderPreview();
    });
  });
}

function paintProductFileList() {
  const list = document.querySelector("#productFileList");
  const count = document.querySelector("#productFileCount");
  const selectAllButton = document.querySelector("#selectAllProducts");
  const deselectAllButton = document.querySelector("#deselectAllProducts");
  const clearButton = document.querySelector("#clearProductFiles");
  if (!list || !count || !selectAllButton || !deselectAllButton || !clearButton) return;

  const selectedCount = getSelectedProductItems().length;
  const locked = isWaitingForProductShape() || state.processing;
  count.textContent = `${selectedCount} / ${state.fileItems.length}`;
  selectAllButton.disabled = !state.fileItems.length || locked;
  deselectAllButton.disabled = !state.fileItems.length || locked;
  clearButton.disabled = !state.fileItems.length || locked;
  selectAllButton.textContent = selectedCount === state.fileItems.length && state.fileItems.length ? "已全选" : "全选";
  deselectAllButton.textContent = selectedCount === 0 && state.fileItems.length ? "已全不选" : "全部不勾选";

  if (!state.fileItems.length) {
    list.innerHTML = `<p class="muted">还没有上传产品图片。</p>`;
    return;
  }

  list.innerHTML = state.fileItems
    .map(
      (item) => `
        <div class="product-file-row ${item.selected ? "product-file-row--selected" : ""} ${locked ? "product-file-row--disabled" : ""}">
          <label class="product-file-pick">
            <input type="checkbox" data-product-file-id="${escapeHtml(item.id)}" ${item.selected ? "checked" : ""} ${locked ? "disabled" : ""} />
            <img src="${item.url}" alt="${escapeHtml(item.file.name)}" loading="lazy" decoding="async" />
            <span title="${escapeHtml(item.file.webkitRelativePath || item.file.name)}">${escapeHtml(item.file.name)}</span>
          </label>
          <button class="product-file-remove" type="button" data-product-file-remove-id="${escapeHtml(item.id)}" ${locked ? "disabled" : ""} title="删除这张图片" aria-label="删除 ${escapeHtml(item.file.name)}">×</button>
        </div>
      `,
    )
    .join("");

  list.querySelectorAll("[data-product-file-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const item = state.fileItems.find((fileItem) => fileItem.id === event.target.dataset.productFileId);
      if (!item) return;
      item.selected = event.target.checked;
      clearRendered();
      updateUi(item.selected ? "已勾选这张图片" : "已取消这张图片");
      renderPreview();
    });
  });

  list.querySelectorAll("[data-product-file-remove-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      removeProductFile(event.currentTarget.dataset.productFileRemoveId);
    });
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function syncOptionLabels() {
  ["size", "depth", "lightAngle", "lightStrength", "glare", "viewTilt", "spotlight", "badgeSize"].forEach((id) => {
    const label = document.querySelector(`#${id}Value`);
    if (label) label.textContent = state.options[id];
  });
  const sizeValueY = document.querySelector("#sizeValueY");
  if (sizeValueY) sizeValueY.textContent = state.options.size;
}

function syncOutputSizeControl() {
  const toggle = document.querySelector("#adjustOutputSize");
  const field = document.querySelector("#outputSizeField");
  if (toggle) toggle.checked = Boolean(state.options.adjustOutputSize);
  if (field) field.classList.toggle("field--hidden", !state.options.adjustOutputSize);
}

function syncProductShapeControl() {
  const select = document.querySelector("#productShape");
  const field = document.querySelector("#productShapeField");
  if (!select || !field) return;
  const enabled = state.fileItems.length > 0 && !state.processing;
  select.disabled = !enabled;
  select.value = getSelectedProductShape();
  field.classList.toggle("field--disabled", !enabled);
}

function paintShapeRequiredStage() {
  const stage = document.querySelector("#previewStage");
  stage.style.setProperty("--stage-bg", "#ffffff");
  stage.classList.remove("stage--checker", "stage--placement");
  stage.innerHTML = `
    <div class="empty">
      <span data-icon="sliders"></span>
      <p>已上传产品图片。请先在左侧选择图片形状，背景占位设置会自动切换成对应形状。</p>
    </div>
  `;
  renderIcons();
}

function paintEmptyStage() {
  const stage = document.querySelector("#previewStage");
  stage.style.setProperty("--stage-bg", "#ffffff");
  stage.classList.remove("stage--checker", "stage--placement");
  stage.innerHTML = `
    <div class="empty">
      <span data-icon="image"></span>
      <p>上传 2D 图片后，这里会显示第一张转换预览。</p>
    </div>
  `;
  renderIcons();
}

function paintNoSelectedProductsStage() {
  const stage = document.querySelector("#previewStage");
  stage.style.setProperty("--stage-bg", "#ffffff");
  stage.classList.remove("stage--checker", "stage--placement");
  stage.innerHTML = `
    <div class="empty">
      <span data-icon="image"></span>
      <p>已上传图片。请先在右侧上传图片列表里勾选至少一张需要生成 3D 的图片。</p>
    </div>
  `;
  renderIcons();
}

function paintPlacementStage(backgroundItem, options = {}) {
  if (!hasSelectedProductShape()) {
    paintShapeRequiredStage();
    return;
  }
  const stage = document.querySelector("#previewStage");
  const layout = placementLayoutForBackground(backgroundItem);
  backgroundItem.freeLayout = layout;
  const layoutMode = getBackgroundLayoutMode(backgroundItem);
  const fit = state.options.backgroundFit;
  const controls = placementControlModel(layout);
  const shapeLabel = getSelectedProductShapeLabel();
  const preserveFixedCircle = isFixedLayoutMode(layoutMode);
  const fixedScaleText = preserveFixedCircle && layout.shape === "circle" ? "半径占比" : "整体占比";
  const views =
    layoutMode === "free"
      ? [{ cx: (layout.x ?? 50) / 100, cy: (layout.y ?? 50) / 100, r: 0.34, rot: placementRotationRad(layout) }]
      : getFixedLayoutPlaceholderViews(layoutMode);
  const fixedScaleMultiplier = layoutMode === "free" ? 1 : layout.fixedScale / 100;
  const fineTuneEnabled = layoutMode === "free" && isFineTunePlacementShape(layout);
  const fineTuneActive = fineTuneEnabled && layout.fineTune;
  const roundFineTuneEnabled = fineTuneActive && isRoundPlacementShape(layout);
  const lockPrimary = fineTuneActive && (layout.shape === "rectangle" || layout.shape === "polygon" || isRoundPlacementShape(layout));
  const lockSecondary = fineTuneActive && (layout.shape === "rectangle" || isRoundPlacementShape(layout));
  const lockSides = fineTuneActive && layout.shape === "polygon";
  stage.style.setProperty("--stage-bg", "#f4f5f2");
  stage.classList.remove("stage--checker");
  stage.classList.add("stage--placement");
  const livePreviewUrl = "";
  stage.innerHTML = `
    <div class="placement-workspace">
      <div class="placement-canvas ${livePreviewUrl ? "placement-canvas--live" : ""}" data-background-id="${backgroundItem.id}">
        ${placementBackgroundMarkup(backgroundItem, fit)}
        ${livePreviewUrl ? `<img class="placement-live-preview" src="${livePreviewUrl}" alt="实时 3D 预览" draggable="false" />` : ""}
        ${views.map((view) => placementShapeMarkup(layout, view, { draggable: layoutMode === "free", scaleMultiplier: fixedScaleMultiplier, fineTuneActive, preserveCircle: preserveFixedCircle })).join("")}
        ${state.options.badge ? badgeMarkerMarkup() : ""}
        ${spotlightControlMarkup()}
      </div>
      <div class="placement-controls">
        <div class="placement-control placement-control--select placement-shape-summary">
          <span>图片形状</span>
          <strong>${shapeLabel}</strong>
        </div>
        <label class="placement-control placement-control--scale ${layoutMode === "free" ? "field--hidden" : ""}">
          <span>${fixedScaleText} <b data-placement-value="fixedScale">${layout.fixedScale}</b>%</span>
          <input id="placementFixedScale" class="number-control" type="number" min="0" max="180" step="0.1" value="${layout.fixedScale}" />
        </label>
        <label class="placement-control ${layoutMode === "free" ? "" : "field--hidden"} ${lockPrimary ? "placement-control--locked" : ""}">
          <span>${controls.primaryLabel}</span>
          <input id="placementPrimary" class="number-control" type="number" min="${controls.primaryMin}" max="${controls.primaryMax}" step="${controls.primaryStep}" value="${controls.primaryValue}" ${lockPrimary ? "disabled" : ""} />
        </label>
        <label class="placement-control ${layoutMode === "free" && controls.secondaryKey ? "" : "field--hidden"} ${lockSecondary ? "placement-control--locked" : ""}">
          <span>${controls.secondaryLabel || "短边"}</span>
          <input id="placementSecondary" class="number-control" type="number" min="${controls.secondaryMin ?? 0}" max="${controls.secondaryMax ?? 180}" step="${controls.secondaryStep ?? 1}" value="${controls.secondaryValue ?? 80}" ${lockSecondary ? "disabled" : ""} />
        </label>
        <label class="placement-control ${controls.showSides ? "" : "field--hidden"} ${lockSides ? "placement-control--locked" : ""}">
          <span>边数</span>
          <input id="placementSides" class="number-control" type="number" min="3" max="12" step="1" value="${layout.sides}" ${lockSides ? "disabled" : ""} />
        </label>
        <label class="placement-control ${layoutMode === "free" ? "" : "field--hidden"}">
          <span>旋转角度</span>
          <input id="placementRotation" class="number-control" type="number" min="-180" max="180" step="0.1" value="${layout.rotation}" />
        </label>
        <label class="placement-control ${layoutMode === "free" ? "" : "field--hidden"}">
          <span>边缘颜色</span>
          <select id="placementTuneLineColor" class="number-control">
            <option value="black" ${layout.tuneLineColor === "black" ? "selected" : ""}>黑色</option>
            <option value="white" ${layout.tuneLineColor === "white" ? "selected" : ""}>白色</option>
            <option value="red" ${layout.tuneLineColor === "red" ? "selected" : ""}>红色</option>
          </select>
        </label>
        <label class="placement-control placement-control--toggle ${fineTuneEnabled ? "" : "field--hidden"}">
          <span>${placementFineTuneLabel(layout)}</span>
          <input id="placementFineTune" type="checkbox" ${layout.fineTune ? "checked" : ""} />
        </label>
        <label class="placement-control ${roundFineTuneEnabled ? "" : "field--hidden"}">
          <span>微调点数</span>
          <input id="placementRoundPointCount" class="number-control" type="number" min="${PLACEMENT_ROUND_POINT_MIN}" max="${PLACEMENT_ROUND_POINT_MAX}" step="1" value="${layout.roundPointCount}" />
        </label>
      </div>
    </div>
  `;
  paintBadgeMarkerCanvases(stage);
  bindPlacementStage(backgroundItem);
}

function bindPlacementStage(backgroundItem) {
  const stage = document.querySelector("#previewStage");
  const canvas = stage.querySelector(".placement-canvas");
  const shapes = Array.from(stage.querySelectorAll(".placement-stage-shape"));
  const primaryInput = stage.querySelector("#placementPrimary");
  const secondaryInput = stage.querySelector("#placementSecondary");
  const sidesInput = stage.querySelector("#placementSides");
  const rotationInput = stage.querySelector("#placementRotation");
  const fixedScaleInput = stage.querySelector("#placementFixedScale");
  const fineTuneInput = stage.querySelector("#placementFineTune");
  const roundPointCountInput = stage.querySelector("#placementRoundPointCount");
  const tuneLineColorInput = stage.querySelector("#placementTuneLineColor");
  const fixedScaleLabel = stage.querySelector("[data-placement-value='fixedScale']");
  const badgeMarker = stage.querySelector(".badge-marker");
  const layoutMode = getBackgroundLayoutMode(backgroundItem);
  if (!canvas || !shapes.length || !primaryInput || !secondaryInput || !sidesInput || !rotationInput || !fixedScaleInput || !fineTuneInput || !roundPointCountInput || !tuneLineColorInput || !fixedScaleLabel) return;

  const updateShapeElement = () => {
    const layout = placementLayoutForBackground(backgroundItem);
    const controls = placementControlModel(layout);
    backgroundItem.freeLayout = layout;
    const views =
      layoutMode === "free"
        ? [{ cx: (layout.x ?? 50) / 100, cy: (layout.y ?? 50) / 100, r: 0.34, rot: placementRotationRad(layout) }]
        : getFixedLayoutPlaceholderViews(layoutMode);
    const fixedScaleMultiplier = layoutMode === "free" ? 1 : layout.fixedScale / 100;
    const preserveFixedCircle = isFixedLayoutMode(layoutMode);
    shapes.forEach((shape, index) => {
      const view = views[index] || views[0];
      const dimensions = placementDimensionsForView(layout, fixedScaleMultiplier, { preserveCircle: preserveFixedCircle });
      const scale = view.r / 0.34;
      const viewScaleX = preserveFixedCircle && layout.shape === "circle" ? 1 : view.x ?? 1;
      const viewScaleY = preserveFixedCircle && layout.shape === "circle" ? 1 : view.y ?? 1;
      const fineTuneActive = layoutMode === "free" && layout.fineTune && isFineTunePlacementShape(layout);
      const roundResize = fineTuneActive && isRoundPlacementShape(layout);
      const coarseResize = layoutMode === "free" && !fineTuneActive && isFineTunePlacementShape(layout);
      shape.className = `placement-stage-shape placement-stage-shape--${layout.shape} ${layoutMode === "free" ? "placement-stage-shape--draggable" : "placement-stage-shape--fixed"} ${roundResize || coarseResize ? "placement-stage-shape--resizable" : ""} ${fineTuneActive ? "placement-stage-shape--fine-tune" : ""}`;
      shape.style.left = `${(view.cx * 100).toFixed(3)}%`;
      shape.style.top = `${(view.cy * 100).toFixed(3)}%`;
      shape.style.width = `${clamp(dimensions.width * scale * viewScaleX, 0, 98)}%`;
      shape.style.height = `${clamp(dimensions.height * scale * viewScaleY, 0, 98)}%`;
      shape.style.setProperty("--shape-rotate", `${fineTuneActive ? 0 : view.rot || 0}rad`);
      shape.style.setProperty("--polygon-path", regularPolygonClipPath(layout.sides));
      shape.style.setProperty("--tune-color", placementTuneLineColor(layout));
      const polygon = shape.querySelector(".placement-outline-svg--polygon polygon");
      if (polygon) polygon.setAttribute("points", fineTuneActive && layout.shape === "polygon" ? placementPolygonSvgPoints(layout, dimensions) : regularPolygonSvgPoints(layout.sides));
      const quadPolygon = shape.querySelector(".placement-quad-svg polygon");
      if (quadPolygon) quadPolygon.setAttribute("points", placementQuadSvgPoints(layout, dimensions));
      const roundPath = shape.querySelector(".placement-outline-svg--round path");
      if (roundPath) roundPath.setAttribute("d", placementRoundCurveSvgPath(layout, dimensions));
      shape.querySelectorAll(".placement-resize-handle").forEach((handle) => {
        const pointIndex = handle.dataset.roundIndex;
        if (typeof pointIndex === "undefined" || !isRoundPlacementShape(layout)) return;
        const point = roundPointPercent(layout, dimensions, pointIndex);
        handle.style.left = `${point.x}%`;
        handle.style.top = `${point.y}%`;
      });
      shape.querySelectorAll(".placement-corner-handle").forEach((handle) => {
        let point = null;
        if (handle.dataset.corner) {
          const corners = placementQuadCorners(layout);
          point = corners[handle.dataset.corner] ? placementPointToElementPercent(corners[handle.dataset.corner], dimensions) : null;
        } else if (handle.dataset.pointIndex) {
          const points = placementPolygonPoints(layout);
          const pointIndex = Number(handle.dataset.pointIndex);
          point = points[pointIndex] ? placementPointToElementPercent(points[pointIndex], dimensions) : null;
        }
        if (!point) return;
        handle.style.left = `${point.x}%`;
        handle.style.top = `${point.y}%`;
      });
    });
    primaryInput.value = controls.primaryValue;
    secondaryInput.value = controls.secondaryValue || 0;
    sidesInput.value = layout.sides;
    rotationInput.value = layout.rotation;
    fixedScaleInput.value = layout.fixedScale;
    fineTuneInput.checked = layout.fineTune;
    roundPointCountInput.value = layout.roundPointCount;
    roundPointCountInput.disabled = !(layoutMode === "free" && layout.fineTune && isRoundPlacementShape(layout));
    tuneLineColorInput.value = layout.tuneLineColor;
    fixedScaleLabel.textContent = layout.fixedScale;
    const lockPrimary = layoutMode === "free" && layout.fineTune && (layout.shape === "rectangle" || layout.shape === "polygon" || isRoundPlacementShape(layout));
    const lockSecondary = layoutMode === "free" && layout.fineTune && (layout.shape === "rectangle" || isRoundPlacementShape(layout));
    const lockSides = layoutMode === "free" && layout.fineTune && layout.shape === "polygon";
    primaryInput.disabled = lockPrimary;
    secondaryInput.disabled = lockSecondary;
    sidesInput.disabled = lockSides;
    clearNumberInputState(primaryInput, secondaryInput, sidesInput, rotationInput, fixedScaleInput, roundPointCountInput);
  };

  const savePlacementChange = (message) => {
    clearRendered();
    updateUi(message);
    scheduleLivePreview();
  };

  const pointerToCanvasPercent = (event) => {
    const rect = canvas.getBoundingClientRect();
    const left = rect.left + canvas.clientLeft;
    const top = rect.top + canvas.clientTop;
    const width = canvas.clientWidth || rect.width;
    const height = canvas.clientHeight || rect.height;
    return {
      x: clamp(((event.clientX - left) / width) * 100, 0, 100),
      y: clamp(((event.clientY - top) / height) * 100, 0, 100),
    };
  };

  const spotlightControl = stage.querySelector(".spotlight-control");
  const updateSpotlightControl = () => {
    if (!spotlightControl) return;
    const strength = clamp(numberOr(state.options.spotlight, 0), 0, 100);
    const x = clamp(numberOr(state.options.spotlightX, 38), 0, 100);
    const y = clamp(numberOr(state.options.spotlightY, 34), 0, 100);
    const width = clamp(numberOr(state.options.spotlightWidth ?? state.options.spotlightSize, 46), 1, 140);
    const height = clamp(numberOr(state.options.spotlightHeight ?? state.options.spotlightSize, 46), 1, 140);
    const rotation = clamp(numberOr(state.options.spotlightRotation, 0), -180, 180);
    spotlightControl.style.left = `${x}%`;
    spotlightControl.style.top = `${y}%`;
    spotlightControl.style.width = `${width}%`;
    spotlightControl.style.height = `${height}%`;
    spotlightControl.style.setProperty("--spotlight-rotate", `${rotation}deg`);
    spotlightControl.style.setProperty("--spotlight-alpha", `${0.16 + (strength / 100) * 0.42}`);
    spotlightControl.style.setProperty("--spotlight-color", state.options.spotlightColor || "#ffffff");
  };

  const saveSpotlightChange = (message = "光斑位置已更新，可以重新生成") => {
    clearRendered();
    updateUi(message);
    scheduleLivePreview();
  };

  if (spotlightControl) {
    let isDraggingSpotlight = false;
    let dragMode = "";
    let dragStartPoint = null;
    let dragStart = null;
    let dragMoved = false;

    const spotlightLocalPoint = (point, center, rotationDegrees) => {
      const rotation = (rotationDegrees * Math.PI) / 180;
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      return {
        x: dx * cos + dy * sin,
        y: -dx * sin + dy * cos,
      };
    };

    const moveSpotlight = (event) => {
      if (!dragStartPoint || !dragStart) return;
      const point = pointerToCanvasPercent(event);
      const deltaX = point.x - dragStartPoint.x;
      const deltaY = point.y - dragStartPoint.y;
      if (dragMode === "move") {
        state.options.spotlightX = clamp(Math.round((dragStart.x + deltaX) * 10) / 10, 0, 100);
        state.options.spotlightY = clamp(Math.round((dragStart.y + deltaY) * 10) / 10, 0, 100);
      } else if (dragMode === "rotate") {
        const angle = Math.atan2(point.y - dragStart.y, point.x - dragStart.x);
        let degrees = Math.round(((angle + Math.PI / 2) * 180) / Math.PI * 10) / 10;
        while (degrees > 180) degrees -= 360;
        while (degrees < -180) degrees += 360;
        state.options.spotlightRotation = degrees;
      } else {
        const centerX = dragStart.x;
        const centerY = dragStart.y;
        const local = spotlightLocalPoint(point, { x: centerX, y: centerY }, dragStart.rotation);
        if (dragMode.includes("x")) {
          state.options.spotlightWidth = clamp(Math.round(Math.abs(local.x) * 20) / 10, 1, 140);
        }
        if (dragMode.includes("y")) {
          state.options.spotlightHeight = clamp(Math.round(Math.abs(local.y) * 20) / 10, 1, 140);
        }
      }
      dragMoved = dragMoved || Math.abs(deltaX) > 0.05 || Math.abs(deltaY) > 0.05;
      updateSpotlightControl();
      clearRendered();
      scheduleLivePreview();
    };

    spotlightControl.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      isDraggingSpotlight = true;
      const rotateHandle = event.target.closest("[data-spotlight-rotate]");
      const sideHandle = event.target.closest("[data-spotlight-axis]");
      const cornerHandle = event.target.closest("[data-spotlight-corner]");
      dragMode = rotateHandle ? "rotate" : cornerHandle ? "xy" : sideHandle?.dataset.spotlightAxis || "move";
      dragStartPoint = pointerToCanvasPercent(event);
      dragStart = {
        x: clamp(numberOr(state.options.spotlightX, 38), 0, 100),
        y: clamp(numberOr(state.options.spotlightY, 34), 0, 100),
        width: clamp(numberOr(state.options.spotlightWidth ?? state.options.spotlightSize, 46), 1, 140),
        height: clamp(numberOr(state.options.spotlightHeight ?? state.options.spotlightSize, 46), 1, 140),
        rotation: clamp(numberOr(state.options.spotlightRotation, 0), -180, 180),
      };
      dragMoved = false;
      spotlightControl.setPointerCapture(event.pointerId);
      moveSpotlight(event);
    });
    spotlightControl.addEventListener("pointermove", (event) => {
      if (!isDraggingSpotlight) return;
      event.preventDefault();
      event.stopPropagation();
      moveSpotlight(event);
    });
    spotlightControl.addEventListener("pointerup", (event) => {
      if (!isDraggingSpotlight) return;
      event.preventDefault();
      event.stopPropagation();
      isDraggingSpotlight = false;
      spotlightControl.releasePointerCapture(event.pointerId);
      saveSpotlightChange(dragMode === "move" ? "光斑位置已更新，可以重新生成" : dragMode === "rotate" ? "光斑旋转角度已更新，可以重新生成" : "光斑大小和压缩已更新，可以重新生成");
      dragMode = "";
      dragStartPoint = null;
      dragStart = null;
      dragMoved = false;
    });
    spotlightControl.addEventListener("pointercancel", () => {
      isDraggingSpotlight = false;
      dragMode = "";
      dragStartPoint = null;
      dragStart = null;
      dragMoved = false;
    });
  }

  bindBadgeMarkerDrag(canvas, badgeMarker);

  if (layoutMode === "free") {
    const resizeHandles = Array.from(stage.querySelectorAll(".placement-resize-handle"));
    resizeHandles.forEach((handle) => {
      let isDraggingResize = false;
      const axis = handle.dataset.resizeAxis;
      const resizeMode = handle.dataset.resizeCorner ? "uniform" : "axis";
      const roundIndex = handle.dataset.roundIndex;
      const moveResize = (event) => {
        const point = pointerToCanvasPercent(event);
        const layout = placementLayoutForBackground(backgroundItem);
        backgroundItem.freeLayout = layout.fineTune && isRoundPlacementShape(layout) ? fitRoundPlacementPoint(layout, roundIndex, point) : fitPlacementCoarseResize(layout, axis, point, resizeMode);
        updateShapeElement();
        clearRendered();
        scheduleLivePreview();
      };

      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        isDraggingResize = true;
        handle.setPointerCapture(event.pointerId);
        moveResize(event);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!isDraggingResize) return;
        event.preventDefault();
        event.stopPropagation();
        moveResize(event);
      });
      handle.addEventListener("pointerup", (event) => {
        if (!isDraggingResize) return;
        event.preventDefault();
        event.stopPropagation();
        isDraggingResize = false;
        handle.releasePointerCapture(event.pointerId);
        const layout = placementLayoutForBackground(backgroundItem);
        savePlacementChange(layout.fineTune && isRoundPlacementShape(layout) ? "椭圆贴合点已独立微调，可以重新生成" : resizeMode === "uniform" ? "整体尺寸已等比更新，可以重新生成" : axis === "x" ? "横向边长已更新，可以重新生成" : "纵向边长已更新，可以重新生成");
      });
      handle.addEventListener("pointercancel", () => {
        isDraggingResize = false;
      });
    });

    const cornerHandles = Array.from(stage.querySelectorAll(".placement-corner-handle"));
    cornerHandles.forEach((handle) => {
      let isDraggingCorner = false;
      const corner = handle.dataset.corner;
      const pointIndex = handle.dataset.pointIndex;
      const moveCorner = (event) => {
        const point = pointerToCanvasPercent(event);
        const layout = placementLayoutForBackground(backgroundItem);
        backgroundItem.freeLayout =
          typeof corner === "string"
            ? fitPlacementRectangleCorner(layout, corner, point)
            : fitPlacementPolygonPoint(layout, pointIndex, point);
        updateShapeElement();
      };

      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        isDraggingCorner = true;
        handle.setPointerCapture(event.pointerId);
        moveCorner(event);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!isDraggingCorner) return;
        event.preventDefault();
        event.stopPropagation();
        moveCorner(event);
      });
      handle.addEventListener("pointerup", (event) => {
        if (!isDraggingCorner) return;
        event.preventDefault();
        event.stopPropagation();
        isDraggingCorner = false;
        handle.releasePointerCapture(event.pointerId);
        savePlacementChange(corner ? "矩形四角已微调，可以重新生成" : "多边形顶点已微调，可以重新生成");
      });
      handle.addEventListener("pointercancel", () => {
        isDraggingCorner = false;
      });
    });

    let isDraggingShape = false;
    let dragPointerId = null;
    let dragStartPoint = null;
    let dragStartLayout = null;
    let dragMoved = false;
    const moveShapeByDrag = (event) => {
      if (!dragStartPoint || !dragStartLayout) return;
      const currentPoint = pointerToCanvasPercent(event);
      const nextX = clamp(dragStartLayout.x + currentPoint.x - dragStartPoint.x, 0, 100);
      const nextY = clamp(dragStartLayout.y + currentPoint.y - dragStartPoint.y, 0, 100);
      dragMoved = dragMoved || Math.abs(nextX - dragStartLayout.x) > 0.05 || Math.abs(nextY - dragStartLayout.y) > 0.05;
      backgroundItem.freeLayout = { ...placementLayoutForBackground(backgroundItem), x: nextX, y: nextY };
      updateShapeElement();
      clearRendered();
      scheduleLivePreview();
    };

    shapes.forEach((shape) => {
      shape.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".placement-corner-handle, .placement-resize-handle")) return;
        event.preventDefault();
        event.stopPropagation();
        isDraggingShape = true;
        dragMoved = false;
        dragPointerId = event.pointerId;
        dragStartPoint = pointerToCanvasPercent(event);
        dragStartLayout = placementLayoutForBackground(backgroundItem);
        shape.setPointerCapture(event.pointerId);
      });
      shape.addEventListener("pointermove", (event) => {
        if (!isDraggingShape || event.pointerId !== dragPointerId) return;
        event.preventDefault();
        event.stopPropagation();
        moveShapeByDrag(event);
      });
      shape.addEventListener("pointerup", (event) => {
        if (!isDraggingShape || event.pointerId !== dragPointerId) return;
        event.preventDefault();
        event.stopPropagation();
        isDraggingShape = false;
        dragPointerId = null;
        shape.releasePointerCapture(event.pointerId);
        if (dragMoved) savePlacementChange("图形占位位置已更新，可以重新生成");
        dragStartPoint = null;
        dragStartLayout = null;
      });
      shape.addEventListener("pointercancel", () => {
        isDraggingShape = false;
        dragPointerId = null;
        dragStartPoint = null;
        dragStartLayout = null;
        dragMoved = false;
      });
    });
  }

  fineTuneInput.addEventListener("change", (event) => {
    const layout = placementLayoutForBackground(backgroundItem);
    backgroundItem.freeLayout = event.target.checked ? prepareFineTuneLayout(layout) : { ...layout, fineTune: false };
    clearRendered();
    const enabledMessage =
      layout.shape === "polygon"
        ? "顶点微调已开启，边长和边数已锁定"
        : layout.shape === "rectangle"
          ? "四角微调已开启，长和宽已锁定"
          : "椭圆贴合微调已开启，可以拖动上下左右边缘点";
    updateUi(event.target.checked ? enabledMessage : "微调已关闭");
    paintPlacementStage(backgroundItem);
    scheduleLivePreview();
  });

  tuneLineColorInput.addEventListener("change", (event) => {
    const layout = placementLayoutForBackground(backgroundItem);
    backgroundItem.freeLayout = { ...layout, tuneLineColor: normalizeTuneLineColor(event.target.value) };
    clearRendered();
    updateUi("边缘颜色已更新");
    paintPlacementStage(backgroundItem);
  });

  roundPointCountInput.addEventListener("input", (event) => {
    const value = readBoundedNumberInput(event.target, { integer: true });
    if (value === null) return;
    const layout = placementLayoutForBackground(backgroundItem);
    if (!isRoundPlacementShape(layout) || !layout.fineTune) return;
    backgroundItem.freeLayout = { ...layout, roundPointCount: value, roundPoints: null };
    clearRendered();
    updateUi(`椭圆微调点数已设为 ${value}，可以逐点调整`);
    paintPlacementStage(backgroundItem);
    scheduleLivePreview();
  });

  primaryInput.addEventListener("input", (event) => {
    const value = readBoundedNumberInput(event.target);
    if (value === null) return;
    const layout = placementLayoutForBackground(backgroundItem);
    if (layoutMode === "free" && layout.fineTune && (layout.shape === "rectangle" || layout.shape === "polygon" || isRoundPlacementShape(layout))) return;
    const controls = placementControlModel(layout);
    backgroundItem.freeLayout = { ...layout, [controls.primaryKey]: value, quadCorners: layout.shape === "rectangle" ? null : layout.quadCorners, polygonPoints: layout.shape === "polygon" ? null : layout.polygonPoints, roundAnchors: isRoundPlacementShape(layout) ? null : layout.roundAnchors };
    updateShapeElement();
    savePlacementChange(`${controls.primaryLabel}已更新，可以重新生成`);
  });

  secondaryInput.addEventListener("input", (event) => {
    const layout = placementLayoutForBackground(backgroundItem);
    if (layoutMode === "free" && layout.fineTune && (layout.shape === "rectangle" || isRoundPlacementShape(layout))) return;
    const controls = placementControlModel(layout);
    if (!controls.secondaryKey) return;
    const value = readBoundedNumberInput(event.target);
    if (value === null) return;
    backgroundItem.freeLayout = { ...layout, [controls.secondaryKey]: value, quadCorners: layout.shape === "rectangle" ? null : layout.quadCorners, roundAnchors: isRoundPlacementShape(layout) ? null : layout.roundAnchors };
    updateShapeElement();
    savePlacementChange(`${controls.secondaryLabel}已更新，可以重新生成`);
  });

  sidesInput.addEventListener("input", (event) => {
    const layout = placementLayoutForBackground(backgroundItem);
    if (layoutMode === "free" && layout.fineTune && layout.shape === "polygon") return;
    const value = readBoundedNumberInput(event.target, { integer: true });
    if (value === null) return;
    backgroundItem.freeLayout = { ...layout, sides: value, polygonPoints: null };
    updateShapeElement();
    savePlacementChange("正多边形边数已更新，可以重新生成");
  });

  rotationInput.addEventListener("input", (event) => {
    const layout = placementLayoutForBackground(backgroundItem);
    const value = readBoundedNumberInput(event.target);
    if (value === null) return;
    backgroundItem.freeLayout = { ...layout, rotation: Math.round(value * 10) / 10 };
    updateShapeElement();
    savePlacementChange("旋转角度已更新，可以重新生成");
  });

  fixedScaleInput.addEventListener("input", (event) => {
    const layout = placementLayoutForBackground(backgroundItem);
    const value = readBoundedNumberInput(event.target);
    if (value === null) return;
    backgroundItem.freeLayout = { ...layout, fixedScale: roundToTenth(value) };
    updateShapeElement();
    savePlacementChange("整体占比已更新，可以重新生成");
  });
}

function paintPreview(url, { interactiveBadge = false } = {}) {
  const stage = document.querySelector("#previewStage");
  stage.style.setProperty("--stage-bg", "#ffffff");
  stage.classList.remove("stage--checker", "stage--placement");
  stage.innerHTML = `
    <div class="preview-result-frame">
      <img src="${url}" alt="3D preview" />
      ${interactiveBadge ? badgeMarkerMarkup() : ""}
    </div>
  `;
  if (interactiveBadge) {
    const frame = stage.querySelector(".preview-result-frame");
    const marker = stage.querySelector(".badge-marker");
    paintBadgeMarkerCanvases(stage);
    bindBadgeMarkerDrag(frame, marker);
  }
}

function showRenderedResult(index, status) {
  const item = state.rendered[index];
  if (!item) return;
  state.viewMode = "result";
  revokePreview();
  state.selectedRenderedIndex = index;
  paintPreview(item.url);
  document.querySelector("#previewModeLabel").textContent = "成品预览";
  document.querySelector("#statusTitle").textContent = status || `已显示 ${item.name}`;
  document.querySelector("#countPill").textContent = `${state.rendered.length} 张成品`;
  paintFileList(state.rendered.length);
  renderIcons();
}

function paintFileList(doneCount) {
  const list = document.querySelector("#fileList");
  const locked = isWaitingForProductShape() || state.processing;
  if (state.rendered.length) {
    list.innerHTML = state.rendered
      .map((item, index) => {
        const active = index === state.selectedRenderedIndex;
        return `
          <button class="file-row file-row--button ${active ? "file-row--active" : ""} ${locked ? "file-row--muted" : ""}" data-rendered-index="${index}" ${locked ? "disabled" : ""}>
            <img src="${item.url}" alt="${item.name}" loading="lazy" decoding="async" />
            <span title="${item.name}">${item.backgroundLabel}｜${item.file.name}</span>
          </button>
        `;
      })
      .join("");
    list.querySelectorAll("[data-rendered-index]").forEach((button) => {
      button.addEventListener("click", () => {
        if (locked) return;
        const index = Number(button.dataset.renderedIndex);
        showRenderedResult(index, `已显示 ${state.rendered[index].name}`);
      });
    });
    return;
  }

  list.innerHTML = `<p class="muted">生成后，这里会显示可点击预览的成品图。</p>`;
}

function revokePreview() {
  livePreviewRequestId += 1;
  if (livePreviewTimer) {
    clearTimeout(livePreviewTimer);
    livePreviewTimer = null;
  }
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = "";
}

function svg(paths) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const iconArchive = svg('<rect width="20" height="5" x="2" y="3" rx="1"></rect><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>');
const iconCheck = svg('<path d="M20 6 9 17l-5-5"></path><path d="M21 12a9 9 0 1 1-3-6.7"></path>');
const iconDownload = svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M7 10l5 5 5-5"></path><path d="M12 15V3"></path>');
const iconFolder = svg('<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"></path>');
const iconImage = svg('<rect width="18" height="18" x="3" y="3" rx="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"></path>');
const iconLoader = svg('<path d="M21 12a9 9 0 1 1-6.2-8.6"></path>');
const iconPalette = svg('<circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 5-5 5h-1.5a1.5 1.5 0 0 0 0 3H16a2 2 0 0 1-2 2Z"></path>');
const iconRefresh = svg('<path d="M21 12a9 9 0 0 0-15-6.7L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 15 6.7L21 16"></path><path d="M16 16h5v5"></path>');
const iconSliders = svg('<path d="M21 4H14"></path><path d="M10 4H3"></path><path d="M21 12H12"></path><path d="M8 12H3"></path><path d="M21 20H16"></path><path d="M12 20H3"></path><path d="M14 2v4"></path><path d="M8 10v4"></path><path d="M16 18v4"></path>');
const iconSparkles = svg('<path d="m12 3-1.9 5.8L4 11l6.1 2.2L12 19l1.9-5.8L20 11l-6.1-2.2Z"></path><path d="M5 3v4"></path><path d="M3 5h4"></path><path d="M19 17v4"></path><path d="M17 19h4"></path>');

bootstrap();
