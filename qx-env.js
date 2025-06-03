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
    this.log(`🔔${this.name}, 开始!`);
  }
  done(val = {}) {
    const endTime = Date.now();
    const costTime = (endTime - this.startTime) / 1000;
    this.log("", `🔔${this.name}, 结束! 🕛 ${costTime} 秒\n`);
    $done(val);
  }

  log(...args) {
    console.log(`[${this.name}]`, ...args);
  }

  error(...args) {
    this.log(`❗️[${this.name}][错误]`, ...args);
  }

  msg(title = "", subTitle = "", desc = "", opts = {}) {
    if (typeof opts === "string") {
      opts = {'open-url': opts};
    }
    else if (!opts || typeof opts !== "object") {
      opts = {};
    }
    const options = {};

    let openUrl =
      opts["open-url"] || opts.url || opts.openUrl || $open;
    if (openUrl) Object.assign(options, { "open-url": openUrl });

    let mediaUrl = opts.mediaUrl || opts["media-url"] || $media;
    if (mediaUrl) Object.assign(options, { "media-url": mediaUrl });

    let copy =
      opts["update-pasteboard"] || opts.updatePasteboard || $copy;
    if (copy) Object.assign(options, { "update-pasteboard": copy });

    $notification.post(title, subt, desc, options);
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
