/**
 * 微信读书登录请求监控脚本 (BoxJS版) - 改进版
 * 功能说明：
 * 1. 监控https://i.weread.qq.com/login的请求
 * 2. 提取header中的vid和完整的request_body
 * 3. 将提取的信息格式化为JSON
 * 4. 发送通知提示用户
 * 5. 将信息推送到GitHub Gist，优先查找并更新已存在的指定文件
 *
 * 使用方法：
 * 1. 将此脚本添加到Quantumult X的rewrite_local配置中
 * 2. 在BoxJS中配置GitHub Token和其他选项
 * 3. 重新打开微信读书App并登录
 * 4. 脚本将自动捕获登录请求并处理
 */
class QXEnv {
  constructor(e, t) {
    if ("undefined" == typeof $task)
      throw new Error("请在Quantumult X环境中运行此脚本");
    (this.name = e),
      (this.opts = t || {}),
      (this.startTime = Date.now()),
      this.log(`🔔${this.name}, 开始!`);
  }
  done(e = {}) {
    const t = Date.now(),
      o = (t - this.startTime) / 1e3;
    this.log("", `🔔${this.name}, 结束! 🕛 ${o} 秒\n`), $done(e);
  }
  log(...e) {
    console.log(`[${this.name}]`, ...e);
  }
  error(...e) {
    this.log(`❗️[${this.name}][错误]`, ...e);
  }
  msg(e = "", t = "", o = "", r = {}) {
    "string" == typeof r
      ? (r = { "open-url": r })
      : (r && "object" == typeof r) || (r = {});
    const s = {};
    let n = r["open-url"] || r.url || r.openUrl || $open;
    n && Object.assign(s, { "open-url": n });
    let a = r.mediaUrl || r["media-url"] || $media;
    a && Object.assign(s, { "media-url": a });
    let i = r["update-pasteboard"] || r.updatePasteboard || $copy;
    i && Object.assign(s, { "update-pasteboard": i }),
      $notification.post(e, subt, o, s);
  }
  getVal(e) {
    return $prefs.valueForKey(e);
  }
  setVal(e, t) {
    return $prefs.setValueForKey(t, e);
  }
  queryStr(e) {
    return e && "object" == typeof e
      ? Object.keys(e)
          .map((t) => `${t}=${encodeURIComponent(e[t])}`)
          .join("&")
      : "";
  }
  formatHeaders(e) {
    e &&
      e.headers &&
      (delete e.headers["Content-Type"],
      delete e.headers["Content-Length"],
      delete e.headers["content-type"],
      delete e.headers["content-length"]),
      void 0 === e.followRedirect ||
        e.followRedirect ||
        (e.opts ? (e.opts.redirection = !1) : (e.opts = { redirection: !1 })),
      e.params && (e.url += "?" + this.queryStr(e.params));
  }
  get(e) {
    return this.formatHeaders(e), this.send(e);
  }
  post(e) {
    return (
      this.formatHeaders(e),
      e.method || (e.method = "POST"),
      e.body &&
        e.headers &&
        !e.headers["Content-Type"] &&
        !e.headers["content-type"] &&
        (e.headers["content-type"] = "application/x-www-form-urlencoded"),
      this.send(e)
    );
  }
  patch(e) {
    return (e.method = "PATCH"), this.post(e);
  }
  send(e) {
    const t = (e, t = 1e3) =>
        Promise.race([
          e,
          new Promise((e, o) => {
            setTimeout(() => {
              o(new Error("请求超时"));
            }, t);
          }),
        ]),
      o = $task.fetch(e).catch((e) => {
        throw (this.log(`请求失败: ${e}`), e);
      });
    return this.opts.timeout ? t(o, this.opts.timeout) : o;
  }
}
// 创建Env环境实例
const $ = new QXEnv("微信读书登录信息监控");

// BoxJS 订阅信息
// let boxjsConfig = {
//   id: "WeReadLogin",
//   name: "微信读书登录信息监控",
//   keys: [
//     "wr_github_token",
//     "wr_gist_id",
//     "wr_gist_filename",
//     "wr_gist_description",
//     "wr_enable_gist",
//     "wr_debug_mode",
//   ],
// };

// 从BoxJS获取配置
let githubToken = $.getVal("wr_github_token") || "";
let gistId = $.getVal("wr_gist_id") || "";
let gistFilename = $.getVal("wr_gist_filename") || "weread_login_info.json";
let gistDescription = $.getVal("wr_gist_description") || "微信读书登录信息";
let enableGistUpload = $.getVal("wr_enable_gist") === "true";
let debugMode = true; //$.getdata('wr_debug_mode') === 'true';

// 通知常量
const NOTIFY_TITLE = "微信读书登录信息";
const NOTIFY_SUCCESS_MSG = "登录信息已成功提取";
const NOTIFY_ERROR_MSG = "登录信息提取失败";
const NOTIFY_GIST_SUCCESS = "已成功上传到Gist";
const NOTIFY_GIST_ERROR = "Gist上传失败";

processRequest($request)
  .catch((e) => {
    $.error(`处理请求时出错: ${e}`);
  })
  .finally(() => {
    $.done();
  });

/**
 * 处理微信读书登录请求
 * @param {Object} request - 捕获的HTTP请求对象
 * @returns {Object} - 处理后的请求对象
 */
async function processRequest(request) {
  try {
    $.log("开始处理微信读书登录请求...");

    // 提取关键信息
    const headers = request.headers;
    const vid = headers.vid || "";

    // 解析请求体
    let requestBody = parseRequestBody(request.body);

    // 构建结果对象
    const result = {
      vid,
      requestBody,
      headers,
      captureTime: new Date().toISOString(),
    };

    // 发送通知
    $.msg(NOTIFY_TITLE, NOTIFY_SUCCESS_MSG, "VID: " + vid);
    let gist_body = JSON.stringify(result, null, 2);

    if (debugMode) {
      $.log("微信读书登录信息:\n" + gist_body);
    }

    // 推送到GitHub Gist
    if (enableGistUpload && githubToken) {
      const gistResult = await pushToGist(gist_body);
      if (gistResult.success) {
        $.msg(NOTIFY_TITLE, NOTIFY_GIST_SUCCESS, gistResult.message || "");
      } else {
        $.msg(NOTIFY_TITLE, NOTIFY_GIST_ERROR, gistResult.message || "");
      }
    }

    return request;
  } catch (err) {
    $.log(`处理请求时出错: ${err}`);
    $.msg(NOTIFY_TITLE, NOTIFY_ERROR_MSG, err.toString());
    return request;
  }
}

/**
 * 解析请求体
 * @param {string} body - 请求体
 * @returns {Object} - 解析后的对象
 */
function parseRequestBody(body) {
  if (!body) return {};

  try {
    const bodyText = decodeURIComponent(body);

    // 尝试解析为JSON
    if (bodyText.trim().startsWith("{") && bodyText.trim().endsWith("}")) {
      return JSON.parse(bodyText);
    }

    // 尝试解析为表单数据
    const result = {};
    bodyText.split("&").forEach((param) => {
      const [key, value] = param.split("=");
      if (key && value) {
        result[key] = decodeURIComponent(value);
      }
    });
    return result;
  } catch {
    // 解析失败，返回原始请求体
    return { raw: body };
  }
}

/**
 * 推送数据到GitHub Gist
 * @param {string} content - 要推送的内容
 * @returns {Object} - 推送结果
 */
async function pushToGist(content) {
  try {
    if (!githubToken) {
      return { success: false, message: "GitHub Token未设置" };
    }

    // 设置通用headers
    const headers = {
      Authorization: `token ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "WeReadLoginMonitor",
    };

    if (!gistId) {
      return await createNewGist(content, headers);
    }

    try {
      return await updateGist(content, headers);
    } catch (e) {
      $.error(`更新Gist时出错: ${e}`);
      // 如果更新失败，尝试创建新的Gist
      return await createNewGist(content, headers);
    }
  } catch (error) {
    $.error(`Gist操作出错: ${error}`);
    return { success: false, message: `操作失败: ${error.message || error}` };
  }
}

async function updateGist(content, headers) {
  const updateData = {
    description: gistDescription,
    files: {
      [gistFilename]: {
        content: content,
      },
    },
  };

  const updateResult = await $.patch({
    url: `https://api.github.com/gists/${gistId}`,
    headers: headers,
    body: JSON.stringify(updateData),
  }).then((response) => {
    if (debugMode) {
      $.log(`Gist更新结果: ${JSON.stringify(response, null, 2)}`);
    }
    return {
      status: response.statusCode,
      body: response.body,
    };
  });

  if (updateResult.status === 200) {
    if (debugMode) {
      $.log(`Gist更新成功: ${gistId}, 文件: ${gistFilename}`);
    }

    // 如果之前没有存储过gistId，则现在存储
    if (!gistId) {
      $.setVal("wr_gist_id", targetGistId);
    }

    return { success: true, message: `Gist已更新: ${targetGistId}` };
  } else {
    $.log(`Gist更新失败: ${JSON.stringify(updateResult)}`);
    return { success: false, message: `Gist更新失败: ${updateResult.status}` };
  }
}

/**
 * 创建新的Gist
 * @param {string} content - 要推送的内容
 * @param {Object} headers - 请求头
 * @returns {Object} - 创建结果
 */
async function createNewGist(content, headers) {
  try {
    const createData = {
      description: gistDescription,
      public: false,
      files: {
        [gistFilename]: {
          content: content,
        },
      },
    };

    const createResult = await $.post({
      url: "https://api.github.com/gists",
      headers: headers,
      body: JSON.stringify(createData),
    }).then((response) => {
      return {
        status: response.statusCode,
        body: response.body,
      };
    });

    if (createResult.status === 201) {
      try {
        const resultObj = JSON.parse(createResult.body);
        const newGistId = resultObj.id;

        // 保存新创建的gistId到BoxJS
        if (newGistId) {
          $.setVal("wr_gist_id", newGistId);
          if (debugMode) {
            $.log(`新Gist已创建: ${newGistId}, 文件: ${gistFilename}`);
          }
          return { success: true, message: `新Gist已创建: ${newGistId}` };
        }
      } catch (e) {
        $.log(`解析Gist创建响应失败: ${e}`);
      }
    }

    $.log(`Gist创建失败: ${JSON.stringify(createResult)}`);
    return { success: false, message: `Gist创建失败: ${createResult.status}` };
  } catch (error) {
    $.log(`创建Gist时出错: ${error}`);
    return { success: false, message: `创建失败: ${error.message || error}` };
  }
}
