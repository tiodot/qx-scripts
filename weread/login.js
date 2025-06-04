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
/***************** Env 工具类 *****************/
// 精简的Quantumult X环境工具类 - 来源：https://github.com/chavyleung/scripts/blob/master/Env.js
// 提供了平台检测、持久化存储、HTTP请求、日志记录等功能
class QXEnv {
  constructor(name, opts) {
    if ("undefined" === typeof $task) {
      throw new Error("请在Quantumult X环境中运行此脚本");
    }
    this.name = name;
    this.opts = opts || {};
    this.startTime = Date.now();
    this.log(`🔔开始!`);
  }
  done(val = {}) {
    const endTime = Date.now();
    const costTime = (endTime - this.startTime) / 1000;
    this.log("", `🔔结束! 🕛 ${costTime} 秒\n`);
    $done(val);
  }

  log(...args) {
    console.log(`[${this.name}]`, ...args);
  }

  error(...args) {
    console.log(`❗️[${this.name}][错误]`, ...args);
  }

  msg(title = "", subTitle = "", desc = "", opts = {}) {
    if (typeof opts === "string") {
      opts = { "open-url": opts };
    } else if (!opts || typeof opts !== "object") {
      opts = {};
    }
    const options = {};
    const { $open, $copy, $media } = opts;

    let openUrl = opts["open-url"] || opts.url || opts.openUrl || $open;
    if (openUrl) Object.assign(options, { "open-url": openUrl });

    let mediaUrl = opts.mediaUrl || opts["media-url"] || $media;
    if (mediaUrl) Object.assign(options, { "media-url": mediaUrl });

    let copy = opts["update-pasteboard"] || opts.updatePasteboard || $copy;
    if (copy) Object.assign(options, { "update-pasteboard": copy });

    $notify(title || this.name, subTitle, desc, options);
  }

  getVal(key) {
    return $prefs.valueForKey(key);
  }
  setVal(key, value) {
    return $prefs.setValueForKey(value, key);
  }
  /**
   *
   * @param {Object} options
   * @returns {String} 将 Object 对象 转换成 queryStr: key=val&name=senku
   */
  queryStr(options) {
    if (!options || typeof options !== "object") {
      return "";
    }
    return Object.keys(options)
      .map((key) => `${key}=${encodeURIComponent(options[key])}`)
      .join("&");
  }
  formatHeaders(request) {
    if (request && request.headers) {
      delete request.headers["Content-Type"];
      delete request.headers["Content-Length"];

      delete request.headers["content-type"];
      delete request.headers["content-length"];
    }
    if (
      typeof request.followRedirect !== "undefined" &&
      !request["followRedirect"]
    ) {
      if (request.opts) {
        request["opts"]["redirection"] = false;
      } else {
        request.opts = { redirection: false };
      }
    }

    if (request.params) {
      request.url += "?" + this.queryStr(request.params);
    }
  }
  get(request) {
    this.formatHeaders(request);
    return this.send(request);
  }

  post(request) {
    this.formatHeaders(request);

    if (!request.method) {
      request.method = "POST";
    }

    // 如果指定了请求体, 但没指定 `Content-Type`、`content-type`, 则自动生成。
    if (
      request.body &&
      request.headers &&
      !request.headers["Content-Type"] &&
      !request.headers["content-type"]
    ) {
      // HTTP/1、HTTP/2 都支持小写 headers
      request.headers["content-type"] = "application/x-www-form-urlencoded";
    }

    return this.send(request);
  }
  patch(request) {
    request.method = "PATCH";
    return this.post(request);
  }

  send(request) {
    const delayPromise = (promise, delay = 1000) => {
      return Promise.race([
        promise,
        new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error("请求超时"));
          }, delay);
        }),
      ]);
    };

    const call = $task.fetch(request).catch((err) => {
      this.log(`请求失败: ${err}`);
      throw err;
    });

    return this.opts.timeout ? delayPromise(call, this.opts.timeout) : call;
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
    $.log("脚本执行完毕");
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
