var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod2) => function __require2() {
  return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod2, isNodeMode, target) => (target = mod2 != null ? __create(__getProtoOf(mod2)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod2 || !mod2.__esModule ? __defProp(target, "default", { value: mod2, enumerable: true }) : target,
  mod2
));

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
var init_utils = __esm({
  "node_modules/unenv/dist/runtime/_internal/utils.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    __name(createNotImplementedError, "createNotImplementedError");
    __name(notImplemented, "notImplemented");
  }
});

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin, _performanceNow, nodeTiming, PerformanceEntry, PerformanceMark, PerformanceMeasure, PerformanceResourceTiming, PerformanceObserverEntryList, Performance, PerformanceObserver, performance;
var init_performance = __esm({
  "node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_utils();
    _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
    _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
    nodeTiming = {
      name: "node",
      entryType: "node",
      startTime: 0,
      duration: 0,
      nodeStart: 0,
      v8Start: 0,
      bootstrapComplete: 0,
      environment: 0,
      loopStart: 0,
      loopExit: 0,
      idleTime: 0,
      uvMetricsInfo: {
        loopCount: 0,
        events: 0,
        eventsWaiting: 0
      },
      detail: void 0,
      toJSON() {
        return this;
      }
    };
    PerformanceEntry = class {
      static {
        __name(this, "PerformanceEntry");
      }
      __unenv__ = true;
      detail;
      entryType = "event";
      name;
      startTime;
      constructor(name, options) {
        this.name = name;
        this.startTime = options?.startTime || _performanceNow();
        this.detail = options?.detail;
      }
      get duration() {
        return _performanceNow() - this.startTime;
      }
      toJSON() {
        return {
          name: this.name,
          entryType: this.entryType,
          startTime: this.startTime,
          duration: this.duration,
          detail: this.detail
        };
      }
    };
    PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
      static {
        __name(this, "PerformanceMark");
      }
      entryType = "mark";
      constructor() {
        super(...arguments);
      }
      get duration() {
        return 0;
      }
    };
    PerformanceMeasure = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceMeasure");
      }
      entryType = "measure";
    };
    PerformanceResourceTiming = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceResourceTiming");
      }
      entryType = "resource";
      serverTiming = [];
      connectEnd = 0;
      connectStart = 0;
      decodedBodySize = 0;
      domainLookupEnd = 0;
      domainLookupStart = 0;
      encodedBodySize = 0;
      fetchStart = 0;
      initiatorType = "";
      name = "";
      nextHopProtocol = "";
      redirectEnd = 0;
      redirectStart = 0;
      requestStart = 0;
      responseEnd = 0;
      responseStart = 0;
      secureConnectionStart = 0;
      startTime = 0;
      transferSize = 0;
      workerStart = 0;
      responseStatus = 0;
    };
    PerformanceObserverEntryList = class {
      static {
        __name(this, "PerformanceObserverEntryList");
      }
      __unenv__ = true;
      getEntries() {
        return [];
      }
      getEntriesByName(_name, _type) {
        return [];
      }
      getEntriesByType(type) {
        return [];
      }
    };
    Performance = class {
      static {
        __name(this, "Performance");
      }
      __unenv__ = true;
      timeOrigin = _timeOrigin;
      eventCounts = /* @__PURE__ */ new Map();
      _entries = [];
      _resourceTimingBufferSize = 0;
      navigation = void 0;
      timing = void 0;
      timerify(_fn, _options) {
        throw createNotImplementedError("Performance.timerify");
      }
      get nodeTiming() {
        return nodeTiming;
      }
      eventLoopUtilization() {
        return {};
      }
      markResourceTiming() {
        return new PerformanceResourceTiming("");
      }
      onresourcetimingbufferfull = null;
      now() {
        if (this.timeOrigin === _timeOrigin) {
          return _performanceNow();
        }
        return Date.now() - this.timeOrigin;
      }
      clearMarks(markName) {
        this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
      }
      clearMeasures(measureName) {
        this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
      }
      clearResourceTimings() {
        this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
      }
      getEntries() {
        return this._entries;
      }
      getEntriesByName(name, type) {
        return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
      }
      getEntriesByType(type) {
        return this._entries.filter((e) => e.entryType === type);
      }
      mark(name, options) {
        const entry = new PerformanceMark(name, options);
        this._entries.push(entry);
        return entry;
      }
      measure(measureName, startOrMeasureOptions, endMark) {
        let start;
        let end;
        if (typeof startOrMeasureOptions === "string") {
          start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
          end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
        } else {
          start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
          end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
        }
        const entry = new PerformanceMeasure(measureName, {
          startTime: start,
          detail: {
            start,
            end
          }
        });
        this._entries.push(entry);
        return entry;
      }
      setResourceTimingBufferSize(maxSize) {
        this._resourceTimingBufferSize = maxSize;
      }
      addEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.addEventListener");
      }
      removeEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.removeEventListener");
      }
      dispatchEvent(event) {
        throw createNotImplementedError("Performance.dispatchEvent");
      }
      toJSON() {
        return this;
      }
    };
    PerformanceObserver = class {
      static {
        __name(this, "PerformanceObserver");
      }
      __unenv__ = true;
      static supportedEntryTypes = [];
      _callback = null;
      constructor(callback) {
        this._callback = callback;
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        throw createNotImplementedError("PerformanceObserver.disconnect");
      }
      observe(options) {
        throw createNotImplementedError("PerformanceObserver.observe");
      }
      bind(fn) {
        return fn;
      }
      runInAsyncScope(fn, thisArg, ...args) {
        return fn.call(thisArg, ...args);
      }
      asyncId() {
        return 0;
      }
      triggerAsyncId() {
        return 0;
      }
      emitDestroy() {
        return this;
      }
    };
    performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();
  }
});

// node_modules/unenv/dist/runtime/node/perf_hooks.mjs
var init_perf_hooks = __esm({
  "node_modules/unenv/dist/runtime/node/perf_hooks.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_performance();
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
var init_performance2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs"() {
    init_perf_hooks();
    globalThis.performance = performance;
    globalThis.Performance = Performance;
    globalThis.PerformanceEntry = PerformanceEntry;
    globalThis.PerformanceMark = PerformanceMark;
    globalThis.PerformanceMeasure = PerformanceMeasure;
    globalThis.PerformanceObserver = PerformanceObserver;
    globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
    globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime;
var init_hrtime = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
      const now = Date.now();
      const seconds = Math.trunc(now / 1e3);
      const nanos = now % 1e3 * 1e6;
      if (startTime) {
        let diffSeconds = seconds - startTime[0];
        let diffNanos = nanos - startTime[0];
        if (diffNanos < 0) {
          diffSeconds = diffSeconds - 1;
          diffNanos = 1e9 + diffNanos;
        }
        return [diffSeconds, diffNanos];
      }
      return [seconds, nanos];
    }, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
      return BigInt(Date.now() * 1e6);
    }, "bigint") });
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream;
var init_read_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    ReadStream = class {
      static {
        __name(this, "ReadStream");
      }
      fd;
      isRaw = false;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      setRawMode(mode) {
        this.isRaw = mode;
        return this;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream;
var init_write_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    WriteStream = class {
      static {
        __name(this, "WriteStream");
      }
      fd;
      columns = 80;
      rows = 24;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      clearLine(dir, callback) {
        callback && callback();
        return false;
      }
      clearScreenDown(callback) {
        callback && callback();
        return false;
      }
      cursorTo(x, y, callback) {
        callback && typeof callback === "function" && callback();
        return false;
      }
      moveCursor(dx, dy, callback) {
        callback && callback();
        return false;
      }
      getColorDepth(env2) {
        return 1;
      }
      hasColors(count, env2) {
        return false;
      }
      getWindowSize() {
        return [this.columns, this.rows];
      }
      write(str, encoding, cb) {
        if (str instanceof Uint8Array) {
          str = new TextDecoder().decode(str);
        }
        try {
          console.log(str);
        } catch {
        }
        cb && typeof cb === "function" && cb();
        return false;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/tty.mjs
var init_tty = __esm({
  "node_modules/unenv/dist/runtime/node/tty.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_read_stream();
    init_write_stream();
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION;
var init_node_version = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    NODE_VERSION = "22.14.0";
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";
var Process;
var init_process = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/process.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_tty();
    init_utils();
    init_node_version();
    Process = class _Process extends EventEmitter {
      static {
        __name(this, "Process");
      }
      env;
      hrtime;
      nextTick;
      constructor(impl) {
        super();
        this.env = impl.env;
        this.hrtime = impl.hrtime;
        this.nextTick = impl.nextTick;
        for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
          const value = this[prop];
          if (typeof value === "function") {
            this[prop] = value.bind(this);
          }
        }
      }
      // --- event emitter ---
      emitWarning(warning, type, code) {
        console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
      }
      emit(...args) {
        return super.emit(...args);
      }
      listeners(eventName) {
        return super.listeners(eventName);
      }
      // --- stdio (lazy initializers) ---
      #stdin;
      #stdout;
      #stderr;
      get stdin() {
        return this.#stdin ??= new ReadStream(0);
      }
      get stdout() {
        return this.#stdout ??= new WriteStream(1);
      }
      get stderr() {
        return this.#stderr ??= new WriteStream(2);
      }
      // --- cwd ---
      #cwd = "/";
      chdir(cwd2) {
        this.#cwd = cwd2;
      }
      cwd() {
        return this.#cwd;
      }
      // --- dummy props and getters ---
      arch = "";
      platform = "";
      argv = [];
      argv0 = "";
      execArgv = [];
      execPath = "";
      title = "";
      pid = 200;
      ppid = 100;
      get version() {
        return `v${NODE_VERSION}`;
      }
      get versions() {
        return { node: NODE_VERSION };
      }
      get allowedNodeEnvironmentFlags() {
        return /* @__PURE__ */ new Set();
      }
      get sourceMapsEnabled() {
        return false;
      }
      get debugPort() {
        return 0;
      }
      get throwDeprecation() {
        return false;
      }
      get traceDeprecation() {
        return false;
      }
      get features() {
        return {};
      }
      get release() {
        return {};
      }
      get connected() {
        return false;
      }
      get config() {
        return {};
      }
      get moduleLoadList() {
        return [];
      }
      constrainedMemory() {
        return 0;
      }
      availableMemory() {
        return 0;
      }
      uptime() {
        return 0;
      }
      resourceUsage() {
        return {};
      }
      // --- noop methods ---
      ref() {
      }
      unref() {
      }
      // --- unimplemented methods ---
      umask() {
        throw createNotImplementedError("process.umask");
      }
      getBuiltinModule() {
        return void 0;
      }
      getActiveResourcesInfo() {
        throw createNotImplementedError("process.getActiveResourcesInfo");
      }
      exit() {
        throw createNotImplementedError("process.exit");
      }
      reallyExit() {
        throw createNotImplementedError("process.reallyExit");
      }
      kill() {
        throw createNotImplementedError("process.kill");
      }
      abort() {
        throw createNotImplementedError("process.abort");
      }
      dlopen() {
        throw createNotImplementedError("process.dlopen");
      }
      setSourceMapsEnabled() {
        throw createNotImplementedError("process.setSourceMapsEnabled");
      }
      loadEnvFile() {
        throw createNotImplementedError("process.loadEnvFile");
      }
      disconnect() {
        throw createNotImplementedError("process.disconnect");
      }
      cpuUsage() {
        throw createNotImplementedError("process.cpuUsage");
      }
      setUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
      }
      hasUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
      }
      initgroups() {
        throw createNotImplementedError("process.initgroups");
      }
      openStdin() {
        throw createNotImplementedError("process.openStdin");
      }
      assert() {
        throw createNotImplementedError("process.assert");
      }
      binding() {
        throw createNotImplementedError("process.binding");
      }
      // --- attached interfaces ---
      permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
      report = {
        directory: "",
        filename: "",
        signal: "SIGUSR2",
        compact: false,
        reportOnFatalError: false,
        reportOnSignal: false,
        reportOnUncaughtException: false,
        getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
        writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
      };
      finalization = {
        register: /* @__PURE__ */ notImplemented("process.finalization.register"),
        unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
        registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
      };
      memoryUsage = Object.assign(() => ({
        arrayBuffers: 0,
        rss: 0,
        external: 0,
        heapTotal: 0,
        heapUsed: 0
      }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
      // --- undefined props ---
      mainModule = void 0;
      domain = void 0;
      // optional
      send = void 0;
      exitCode = void 0;
      channel = void 0;
      getegid = void 0;
      geteuid = void 0;
      getgid = void 0;
      getgroups = void 0;
      getuid = void 0;
      setegid = void 0;
      seteuid = void 0;
      setgid = void 0;
      setgroups = void 0;
      setuid = void 0;
      // internals
      _events = void 0;
      _eventsCount = void 0;
      _exiting = void 0;
      _maxListeners = void 0;
      _debugEnd = void 0;
      _debugProcess = void 0;
      _fatalException = void 0;
      _getActiveHandles = void 0;
      _getActiveRequests = void 0;
      _kill = void 0;
      _preload_modules = void 0;
      _rawDebug = void 0;
      _startProfilerIdleNotifier = void 0;
      _stopProfilerIdleNotifier = void 0;
      _tickCallback = void 0;
      _disconnect = void 0;
      _handleQueue = void 0;
      _pendingMessage = void 0;
      _channel = void 0;
      _send = void 0;
      _linkedBinding = void 0;
    };
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess, getBuiltinModule, workerdProcess, isWorkerdProcessV2, unenvProcess, exit, features, platform, env, hrtime3, nextTick, _channel, _disconnect, _events, _eventsCount, _handleQueue, _maxListeners, _pendingMessage, _send, assert, disconnect, mainModule, _debugEnd, _debugProcess, _exiting, _fatalException, _getActiveHandles, _getActiveRequests, _kill, _linkedBinding, _preload_modules, _rawDebug, _startProfilerIdleNotifier, _stopProfilerIdleNotifier, _tickCallback, abort, addListener, allowedNodeEnvironmentFlags, arch, argv, argv0, availableMemory, binding, channel, chdir, config, connected, constrainedMemory, cpuUsage, cwd, debugPort, dlopen, domain, emit, emitWarning, eventNames, execArgv, execPath, exitCode, finalization, getActiveResourcesInfo, getegid, geteuid, getgid, getgroups, getMaxListeners, getuid, hasUncaughtExceptionCaptureCallback, initgroups, kill, listenerCount, listeners, loadEnvFile, memoryUsage, moduleLoadList, off, on, once, openStdin, permission, pid, ppid, prependListener, prependOnceListener, rawListeners, reallyExit, ref, release, removeAllListeners, removeListener, report, resourceUsage, send, setegid, seteuid, setgid, setgroups, setMaxListeners, setSourceMapsEnabled, setuid, setUncaughtExceptionCaptureCallback, sourceMapsEnabled, stderr, stdin, stdout, throwDeprecation, title, traceDeprecation, umask, unref, uptime, version, versions, _process, process_default;
var init_process2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_hrtime();
    init_process();
    globalProcess = globalThis["process"];
    getBuiltinModule = globalProcess.getBuiltinModule;
    workerdProcess = getBuiltinModule("node:process");
    isWorkerdProcessV2 = globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
    unenvProcess = new Process({
      env: globalProcess.env,
      // `hrtime` is only available from workerd process v2
      hrtime: isWorkerdProcessV2 ? workerdProcess.hrtime : hrtime,
      // `nextTick` is available from workerd process v1
      nextTick: workerdProcess.nextTick
    });
    ({ exit, features, platform } = workerdProcess);
    ({
      env: (
        // Always implemented by workerd
        env
      ),
      hrtime: (
        // Only implemented in workerd v2
        hrtime3
      ),
      nextTick: (
        // Always implemented by workerd
        nextTick
      )
    } = unenvProcess);
    ({
      _channel,
      _disconnect,
      _events,
      _eventsCount,
      _handleQueue,
      _maxListeners,
      _pendingMessage,
      _send,
      assert,
      disconnect,
      mainModule
    } = unenvProcess);
    ({
      _debugEnd: (
        // @ts-expect-error `_debugEnd` is missing typings
        _debugEnd
      ),
      _debugProcess: (
        // @ts-expect-error `_debugProcess` is missing typings
        _debugProcess
      ),
      _exiting: (
        // @ts-expect-error `_exiting` is missing typings
        _exiting
      ),
      _fatalException: (
        // @ts-expect-error `_fatalException` is missing typings
        _fatalException
      ),
      _getActiveHandles: (
        // @ts-expect-error `_getActiveHandles` is missing typings
        _getActiveHandles
      ),
      _getActiveRequests: (
        // @ts-expect-error `_getActiveRequests` is missing typings
        _getActiveRequests
      ),
      _kill: (
        // @ts-expect-error `_kill` is missing typings
        _kill
      ),
      _linkedBinding: (
        // @ts-expect-error `_linkedBinding` is missing typings
        _linkedBinding
      ),
      _preload_modules: (
        // @ts-expect-error `_preload_modules` is missing typings
        _preload_modules
      ),
      _rawDebug: (
        // @ts-expect-error `_rawDebug` is missing typings
        _rawDebug
      ),
      _startProfilerIdleNotifier: (
        // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
        _startProfilerIdleNotifier
      ),
      _stopProfilerIdleNotifier: (
        // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
        _stopProfilerIdleNotifier
      ),
      _tickCallback: (
        // @ts-expect-error `_tickCallback` is missing typings
        _tickCallback
      ),
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      arch,
      argv,
      argv0,
      availableMemory,
      binding: (
        // @ts-expect-error `binding` is missing typings
        binding
      ),
      channel,
      chdir,
      config,
      connected,
      constrainedMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      domain: (
        // @ts-expect-error `domain` is missing typings
        domain
      ),
      emit,
      emitWarning,
      eventNames,
      execArgv,
      execPath,
      exitCode,
      finalization,
      getActiveResourcesInfo,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getMaxListeners,
      getuid,
      hasUncaughtExceptionCaptureCallback,
      initgroups: (
        // @ts-expect-error `initgroups` is missing typings
        initgroups
      ),
      kill,
      listenerCount,
      listeners,
      loadEnvFile,
      memoryUsage,
      moduleLoadList: (
        // @ts-expect-error `moduleLoadList` is missing typings
        moduleLoadList
      ),
      off,
      on,
      once,
      openStdin: (
        // @ts-expect-error `openStdin` is missing typings
        openStdin
      ),
      permission,
      pid,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      reallyExit: (
        // @ts-expect-error `reallyExit` is missing typings
        reallyExit
      ),
      ref,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      send,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setMaxListeners,
      setSourceMapsEnabled,
      setuid,
      setUncaughtExceptionCaptureCallback,
      sourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      throwDeprecation,
      title,
      traceDeprecation,
      umask,
      unref,
      uptime,
      version,
      versions
    } = isWorkerdProcessV2 ? workerdProcess : unenvProcess);
    _process = {
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exit,
      finalization,
      features,
      getBuiltinModule,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      nextTick,
      on,
      off,
      once,
      pid,
      platform,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      // @ts-expect-error old API
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    };
    process_default = _process;
  }
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process = __esm({
  "node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process"() {
    init_process2();
    globalThis.process = process_default;
  }
});

// node_modules/@noble/hashes/esm/_assert.js
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
var init_assert = __esm({
  "node_modules/@noble/hashes/esm/_assert.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    __name(anumber, "anumber");
    __name(isBytes, "isBytes");
    __name(abytes, "abytes");
    __name(aexists, "aexists");
    __name(aoutput, "aoutput");
  }
});

// node_modules/@noble/hashes/esm/_u64.js
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  let Ah = new Uint32Array(lst.length);
  let Al = new Uint32Array(lst.length);
  for (let i = 0; i < lst.length; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var U32_MASK64, _32n, rotlSH, rotlSL, rotlBH, rotlBL;
var init_u64 = __esm({
  "node_modules/@noble/hashes/esm/_u64.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    _32n = /* @__PURE__ */ BigInt(32);
    __name(fromBig, "fromBig");
    __name(split, "split");
    rotlSH = /* @__PURE__ */ __name((h, l, s) => h << s | l >>> 32 - s, "rotlSH");
    rotlSL = /* @__PURE__ */ __name((h, l, s) => l << s | h >>> 32 - s, "rotlSL");
    rotlBH = /* @__PURE__ */ __name((h, l, s) => l << s - 32 | h >>> 64 - s, "rotlBH");
    rotlBL = /* @__PURE__ */ __name((h, l, s) => h << s - 32 | l >>> 64 - s, "rotlBL");
  }
});

// node_modules/@noble/hashes/esm/crypto.js
var crypto2;
var init_crypto = __esm({
  "node_modules/@noble/hashes/esm/crypto.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    crypto2 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
  }
});

// node_modules/@noble/hashes/esm/utils.js
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("utf8ToBytes expected string, got " + typeof str);
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0; i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function wrapConstructor(hashCons) {
  const hashC = /* @__PURE__ */ __name((msg) => hashCons().update(toBytes(msg)).digest(), "hashC");
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function wrapXOFConstructorWithOpts(hashCons) {
  const hashC = /* @__PURE__ */ __name((msg, opts) => hashCons(opts).update(toBytes(msg)).digest(), "hashC");
  const tmp = hashCons({});
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  return hashC;
}
function randomBytes(bytesLength = 32) {
  if (crypto2 && typeof crypto2.getRandomValues === "function") {
    return crypto2.getRandomValues(new Uint8Array(bytesLength));
  }
  if (crypto2 && typeof crypto2.randomBytes === "function") {
    return crypto2.randomBytes(bytesLength);
  }
  throw new Error("crypto.getRandomValues must be defined");
}
var u32, isLE, byteSwap, Hash;
var init_utils2 = __esm({
  "node_modules/@noble/hashes/esm/utils.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_crypto();
    init_assert();
    u32 = /* @__PURE__ */ __name((arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4)), "u32");
    isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    byteSwap = /* @__PURE__ */ __name((word) => word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255, "byteSwap");
    __name(byteSwap32, "byteSwap32");
    __name(utf8ToBytes, "utf8ToBytes");
    __name(toBytes, "toBytes");
    __name(concatBytes, "concatBytes");
    Hash = class {
      static {
        __name(this, "Hash");
      }
      // Safe version that clones internal state
      clone() {
        return this._cloneInto();
      }
    };
    __name(wrapConstructor, "wrapConstructor");
    __name(wrapXOFConstructorWithOpts, "wrapXOFConstructorWithOpts");
    __name(randomBytes, "randomBytes");
  }
});

// node_modules/@noble/hashes/esm/sha3.js
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  B.fill(0);
}
var SHA3_PI, SHA3_ROTL, _SHA3_IOTA, _0n, _1n, _2n, _7n, _256n, _0x71n, SHA3_IOTA_H, SHA3_IOTA_L, rotlH, rotlL, Keccak, gen, sha3_224, sha3_256, sha3_384, sha3_512, keccak_224, keccak_256, keccak_384, keccak_512, genShake, shake128, shake256;
var init_sha3 = __esm({
  "node_modules/@noble/hashes/esm/sha3.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_assert();
    init_u64();
    init_utils2();
    SHA3_PI = [];
    SHA3_ROTL = [];
    _SHA3_IOTA = [];
    _0n = /* @__PURE__ */ BigInt(0);
    _1n = /* @__PURE__ */ BigInt(1);
    _2n = /* @__PURE__ */ BigInt(2);
    _7n = /* @__PURE__ */ BigInt(7);
    _256n = /* @__PURE__ */ BigInt(256);
    _0x71n = /* @__PURE__ */ BigInt(113);
    for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI.push(2 * (5 * y + x));
      SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
        if (R & _2n)
          t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
      }
      _SHA3_IOTA.push(t);
    }
    [SHA3_IOTA_H, SHA3_IOTA_L] = /* @__PURE__ */ split(_SHA3_IOTA, true);
    rotlH = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s), "rotlH");
    rotlL = /* @__PURE__ */ __name((h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s), "rotlL");
    __name(keccakP, "keccakP");
    Keccak = class _Keccak extends Hash {
      static {
        __name(this, "Keccak");
      }
      // NOTE: we accept arguments in bytes instead of bits here.
      constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        super();
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
        anumber(outputLen);
        if (0 >= this.blockLen || this.blockLen >= 200)
          throw new Error("Sha3 supports only keccak-f1600 function");
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
      }
      keccak() {
        if (!isLE)
          byteSwap32(this.state32);
        keccakP(this.state32, this.rounds);
        if (!isLE)
          byteSwap32(this.state32);
        this.posOut = 0;
        this.pos = 0;
      }
      update(data) {
        aexists(this);
        const { blockLen, state } = this;
        data = toBytes(data);
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          for (let i = 0; i < take; i++)
            state[this.pos++] ^= data[pos++];
          if (this.pos === blockLen)
            this.keccak();
        }
        return this;
      }
      finish() {
        if (this.finished)
          return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 128) !== 0 && pos === blockLen - 1)
          this.keccak();
        state[blockLen - 1] ^= 128;
        this.keccak();
      }
      writeInto(out) {
        aexists(this, false);
        abytes(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len; ) {
          if (this.posOut >= blockLen)
            this.keccak();
          const take = Math.min(blockLen - this.posOut, len - pos);
          out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
          this.posOut += take;
          pos += take;
        }
        return out;
      }
      xofInto(out) {
        if (!this.enableXOF)
          throw new Error("XOF is not possible for this instance");
        return this.writeInto(out);
      }
      xof(bytes) {
        anumber(bytes);
        return this.xofInto(new Uint8Array(bytes));
      }
      digestInto(out) {
        aoutput(out, this);
        if (this.finished)
          throw new Error("digest() was already called");
        this.writeInto(out);
        this.destroy();
        return out;
      }
      digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
      }
      destroy() {
        this.destroyed = true;
        this.state.fill(0);
      }
      _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
      }
    };
    gen = /* @__PURE__ */ __name((suffix, blockLen, outputLen) => wrapConstructor(() => new Keccak(blockLen, suffix, outputLen)), "gen");
    sha3_224 = /* @__PURE__ */ gen(6, 144, 224 / 8);
    sha3_256 = /* @__PURE__ */ gen(6, 136, 256 / 8);
    sha3_384 = /* @__PURE__ */ gen(6, 104, 384 / 8);
    sha3_512 = /* @__PURE__ */ gen(6, 72, 512 / 8);
    keccak_224 = /* @__PURE__ */ gen(1, 144, 224 / 8);
    keccak_256 = /* @__PURE__ */ gen(1, 136, 256 / 8);
    keccak_384 = /* @__PURE__ */ gen(1, 104, 384 / 8);
    keccak_512 = /* @__PURE__ */ gen(1, 72, 512 / 8);
    genShake = /* @__PURE__ */ __name((suffix, blockLen, outputLen) => wrapXOFConstructorWithOpts((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true)), "genShake");
    shake128 = /* @__PURE__ */ genShake(31, 168, 128 / 8);
    shake256 = /* @__PURE__ */ genShake(31, 136, 256 / 8);
  }
});

// node_modules/@noble/post-quantum/esm/utils.js
function equalBytes(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function splitCoder(...lengths) {
  const getLength = /* @__PURE__ */ __name((c) => typeof c === "number" ? c : c.bytesLen, "getLength");
  const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
  return {
    bytesLen,
    encode: /* @__PURE__ */ __name((bufs) => {
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < lengths.length; i++) {
        const c = lengths[i];
        const l = getLength(c);
        const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
        ensureBytes(b, l);
        res.set(b, pos);
        if (typeof c !== "number")
          b.fill(0);
        pos += l;
      }
      return res;
    }, "encode"),
    decode: /* @__PURE__ */ __name((buf) => {
      ensureBytes(buf, bytesLen);
      const res = [];
      for (const c of lengths) {
        const l = getLength(c);
        const b = buf.subarray(0, l);
        res.push(typeof c === "number" ? b : c.decode(b));
        buf = buf.subarray(l);
      }
      return res;
    }, "decode")
  };
}
function vecCoder(c, vecLen) {
  const bytesLen = vecLen * c.bytesLen;
  return {
    bytesLen,
    encode: /* @__PURE__ */ __name((u) => {
      if (u.length !== vecLen)
        throw new Error(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0; i < u.length; i++) {
        const b = c.encode(u[i]);
        res.set(b, pos);
        b.fill(0);
        pos += b.length;
      }
      return res;
    }, "encode"),
    decode: /* @__PURE__ */ __name((a) => {
      ensureBytes(a, bytesLen);
      const r = [];
      for (let i = 0; i < a.length; i += c.bytesLen)
        r.push(c.decode(a.subarray(i, i + c.bytesLen)));
      return r;
    }, "decode")
  };
}
function cleanBytes(...list) {
  for (const t of list) {
    if (Array.isArray(t))
      for (const b of t)
        b.fill(0);
    else
      t.fill(0);
  }
}
function getMask(bits) {
  return (1 << bits) - 1;
}
var ensureBytes, randomBytes2;
var init_utils3 = __esm({
  "node_modules/@noble/post-quantum/esm/utils.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_assert();
    init_utils2();
    ensureBytes = abytes;
    randomBytes2 = randomBytes;
    __name(equalBytes, "equalBytes");
    __name(splitCoder, "splitCoder");
    __name(vecCoder, "vecCoder");
    __name(cleanBytes, "cleanBytes");
    __name(getMask, "getMask");
  }
});

// node_modules/@noble/post-quantum/esm/_crystals.js
function bitReversal(n, bits = 8) {
  const padded = n.toString(2).padStart(8, "0");
  const sliced = padded.slice(-bits).padStart(7, "0");
  const revrsd = sliced.split("").reverse().join("");
  return Number.parseInt(revrsd, 2);
}
var genCrystals, createXofShake, XOF128, XOF256;
var init_crystals = __esm({
  "node_modules/@noble/post-quantum/esm/_crystals.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_sha3();
    init_utils3();
    __name(bitReversal, "bitReversal");
    genCrystals = /* @__PURE__ */ __name((opts) => {
      const { newPoly: newPoly2, N: N2, Q: Q2, F: F2, ROOT_OF_UNITY: ROOT_OF_UNITY2, brvBits, isKyber } = opts;
      const mod2 = /* @__PURE__ */ __name((a, modulo = Q2) => {
        const result = a % modulo | 0;
        return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
      }, "mod");
      const smod2 = /* @__PURE__ */ __name((a, modulo = Q2) => {
        const r = mod2(a, modulo) | 0;
        return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
      }, "smod");
      function getZettas() {
        const out = newPoly2(N2);
        for (let i = 0; i < N2; i++) {
          const b = bitReversal(i, brvBits);
          const p = BigInt(ROOT_OF_UNITY2) ** BigInt(b) % BigInt(Q2);
          out[i] = Number(p) | 0;
        }
        return out;
      }
      __name(getZettas, "getZettas");
      const nttZetas = getZettas();
      const LEN1 = isKyber ? 128 : N2;
      const LEN2 = isKyber ? 1 : 0;
      const NTT2 = {
        encode: /* @__PURE__ */ __name((r) => {
          for (let k = 1, len = 128; len > LEN2; len >>= 1) {
            for (let start = 0; start < N2; start += 2 * len) {
              const zeta = nttZetas[k++];
              for (let j = start; j < start + len; j++) {
                const t = mod2(zeta * r[j + len]);
                r[j + len] = mod2(r[j] - t) | 0;
                r[j] = mod2(r[j] + t) | 0;
              }
            }
          }
          return r;
        }, "encode"),
        decode: /* @__PURE__ */ __name((r) => {
          for (let k = LEN1 - 1, len = 1 + LEN2; len < LEN1 + LEN2; len <<= 1) {
            for (let start = 0; start < N2; start += 2 * len) {
              const zeta = nttZetas[k--];
              for (let j = start; j < start + len; j++) {
                const t = r[j];
                r[j] = mod2(t + r[j + len]);
                r[j + len] = mod2(zeta * (r[j + len] - t));
              }
            }
          }
          for (let i = 0; i < r.length; i++)
            r[i] = mod2(F2 * r[i]);
          return r;
        }, "decode")
      };
      const bitsCoder2 = /* @__PURE__ */ __name((d, c) => {
        const mask = getMask(d);
        const bytesLen = d * (N2 / 8);
        return {
          bytesLen,
          encode: /* @__PURE__ */ __name((poly) => {
            const r = new Uint8Array(bytesLen);
            for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
              buf |= (c.encode(poly[i]) & mask) << bufLen;
              bufLen += d;
              for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
                r[pos++] = buf & getMask(bufLen);
            }
            return r;
          }, "encode"),
          decode: /* @__PURE__ */ __name((bytes) => {
            const r = newPoly2(N2);
            for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
              buf |= bytes[i] << bufLen;
              bufLen += 8;
              for (; bufLen >= d; bufLen -= d, buf >>= d)
                r[pos++] = c.decode(buf & mask);
            }
            return r;
          }, "decode")
        };
      }, "bitsCoder");
      return { mod: mod2, smod: smod2, nttZetas, NTT: NTT2, bitsCoder: bitsCoder2 };
    }, "genCrystals");
    createXofShake = /* @__PURE__ */ __name((shake) => (seed, blockLen) => {
      if (!blockLen)
        blockLen = shake.blockLen;
      const _seed = new Uint8Array(seed.length + 2);
      _seed.set(seed);
      const seedLen = seed.length;
      const buf = new Uint8Array(blockLen);
      let h = shake.create({});
      let calls = 0;
      let xofs = 0;
      return {
        stats: /* @__PURE__ */ __name(() => ({ calls, xofs }), "stats"),
        get: /* @__PURE__ */ __name((x, y) => {
          _seed[seedLen + 0] = x;
          _seed[seedLen + 1] = y;
          h.destroy();
          h = shake.create({}).update(_seed);
          calls++;
          return () => {
            xofs++;
            return h.xofInto(buf);
          };
        }, "get"),
        clean: /* @__PURE__ */ __name(() => {
          h.destroy();
          buf.fill(0);
          _seed.fill(0);
        }, "clean")
      };
    }, "createXofShake");
    XOF128 = /* @__PURE__ */ createXofShake(shake128);
    XOF256 = /* @__PURE__ */ createXofShake(shake256);
  }
});

// node_modules/@noble/post-quantum/esm/ml-dsa.js
var ml_dsa_exports = {};
__export(ml_dsa_exports, {
  PARAMS: () => PARAMS,
  ml_dsa44: () => ml_dsa44,
  ml_dsa65: () => ml_dsa65,
  ml_dsa87: () => ml_dsa87
});
function RejNTTPoly(xof) {
  const r = newPoly(N);
  for (let j = 0; j < N; ) {
    const b = xof();
    if (b.length % 3)
      throw new Error("RejNTTPoly: unaligned block");
    for (let i = 0; j < N && i <= b.length - 3; i += 3) {
      const t = (b[i + 0] | b[i + 1] << 8 | b[i + 2] << 16) & 8388607;
      if (t < Q)
        r[j++] = t;
    }
  }
  return r;
}
function getDilithium(opts) {
  const { K, L, GAMMA1, GAMMA2, TAU, ETA, OMEGA } = opts;
  const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128: XOF1282, XOF256: XOF2562 } = opts;
  if (![2, 4].includes(ETA))
    throw new Error("Wrong ETA");
  if (![1 << 17, 1 << 19].includes(GAMMA1))
    throw new Error("Wrong GAMMA1");
  if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
    throw new Error("Wrong GAMMA2");
  const BETA = TAU * ETA;
  const decompose = /* @__PURE__ */ __name((r) => {
    const rPlus = mod(r);
    const r0 = smod(rPlus, 2 * GAMMA2) | 0;
    if (rPlus - r0 === Q - 1)
      return { r1: 0 | 0, r0: r0 - 1 | 0 };
    const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
    return { r1, r0 };
  }, "decompose");
  const HighBits = /* @__PURE__ */ __name((r) => decompose(r).r1, "HighBits");
  const LowBits = /* @__PURE__ */ __name((r) => decompose(r).r0, "LowBits");
  const MakeHint = /* @__PURE__ */ __name((z, r) => {
    const res0 = z <= GAMMA2 || z > Q - GAMMA2 || z === Q - GAMMA2 && r === 0 ? 0 : 1;
    return res0;
  }, "MakeHint");
  const UseHint = /* @__PURE__ */ __name((h, r) => {
    const m = Math.floor((Q - 1) / (2 * GAMMA2));
    const { r1, r0 } = decompose(r);
    if (h === 1)
      return r0 > 0 ? mod(r1 + 1, m) | 0 : mod(r1 - 1, m) | 0;
    return r1 | 0;
  }, "UseHint");
  const Power2Round = /* @__PURE__ */ __name((r) => {
    const rPlus = mod(r);
    const r0 = smod(rPlus, 2 ** D) | 0;
    return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
  }, "Power2Round");
  const hintCoder = {
    bytesLen: OMEGA + K,
    encode: /* @__PURE__ */ __name((h) => {
      if (h === false)
        throw new Error("hint.encode: hint is false");
      const res = new Uint8Array(OMEGA + K);
      for (let i = 0, k = 0; i < K; i++) {
        for (let j = 0; j < N; j++)
          if (h[i][j] !== 0)
            res[k++] = j;
        res[OMEGA + i] = k;
      }
      return res;
    }, "encode"),
    decode: /* @__PURE__ */ __name((buf) => {
      const h = [];
      let k = 0;
      for (let i = 0; i < K; i++) {
        const hi = newPoly(N);
        if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
          return false;
        for (let j = k; j < buf[OMEGA + i]; j++) {
          if (j > k && buf[j] <= buf[j - 1])
            return false;
          hi[buf[j]] = 1;
        }
        k = buf[OMEGA + i];
        h.push(hi);
      }
      for (let j = k; j < OMEGA; j++)
        if (buf[j] !== 0)
          return false;
      return h;
    }, "decode")
  };
  const ETACoder = polyCoder(ETA === 2 ? 3 : 4, (i) => ETA - i, (i) => {
    if (!(-ETA <= i && i <= ETA))
      throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA}, ${ETA}]`);
    return i;
  });
  const T0Coder = polyCoder(13, (i) => (1 << D - 1) - i);
  const T1Coder = polyCoder(10);
  const ZCoder = polyCoder(GAMMA1 === 1 << 17 ? 18 : 20, (i) => smod(GAMMA1 - i));
  const W1Coder = polyCoder(GAMMA2 === GAMMA2_1 ? 6 : 4);
  const W1Vec = vecCoder(W1Coder, K);
  const publicCoder = splitCoder(32, vecCoder(T1Coder, K));
  const secretCoder = splitCoder(32, 32, TR_BYTES, vecCoder(ETACoder, L), vecCoder(ETACoder, K), vecCoder(T0Coder, K));
  const sigCoder = splitCoder(C_TILDE_BYTES, vecCoder(ZCoder, L), hintCoder);
  const CoefFromHalfByte = ETA === 2 ? (n) => n < 15 ? 2 - n % 5 : false : (n) => n < 9 ? 4 - n : false;
  function RejBoundedPoly(xof) {
    const r = newPoly(N);
    for (let j = 0; j < N; ) {
      const b = xof();
      for (let i = 0; j < N && i < b.length; i += 1) {
        const d1 = CoefFromHalfByte(b[i] & 15);
        const d2 = CoefFromHalfByte(b[i] >> 4 & 15);
        if (d1 !== false)
          r[j++] = d1;
        if (j < N && d2 !== false)
          r[j++] = d2;
      }
    }
    return r;
  }
  __name(RejBoundedPoly, "RejBoundedPoly");
  const SampleInBall = /* @__PURE__ */ __name((seed) => {
    const pre = newPoly(N);
    const s = shake256.create({}).update(seed);
    const buf = new Uint8Array(shake256.blockLen);
    s.xofInto(buf);
    const masks = buf.slice(0, 8);
    for (let i = N - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N; i++) {
      let b = i + 1;
      for (; b > i; ) {
        b = buf[pos++];
        if (pos < shake256.blockLen)
          continue;
        s.xofInto(buf);
        pos = 0;
      }
      pre[i] = pre[b];
      pre[b] = 1 - ((masks[maskPos] >> maskBit++ & 1) << 1);
      if (maskBit >= 8) {
        maskPos++;
        maskBit = 0;
      }
    }
    return pre;
  }, "SampleInBall");
  const polyPowerRound = /* @__PURE__ */ __name((p) => {
    const res0 = newPoly(N);
    const res1 = newPoly(N);
    for (let i = 0; i < p.length; i++) {
      const { r0, r1 } = Power2Round(p[i]);
      res0[i] = r0;
      res1[i] = r1;
    }
    return { r0: res0, r1: res1 };
  }, "polyPowerRound");
  const polyUseHint = /* @__PURE__ */ __name((u, h) => {
    for (let i = 0; i < N; i++)
      u[i] = UseHint(h[i], u[i]);
    return u;
  }, "polyUseHint");
  const polyMakeHint = /* @__PURE__ */ __name((a, b) => {
    const v = newPoly(N);
    let cnt = 0;
    for (let i = 0; i < N; i++) {
      const h = MakeHint(a[i], b[i]);
      v[i] = h;
      cnt += h;
    }
    return { v, cnt };
  }, "polyMakeHint");
  const signRandBytes = 32;
  const seedCoder = splitCoder(32, 64, 32);
  const internal = {
    signRandBytes,
    keygen: /* @__PURE__ */ __name((seed = randomBytes2(32)) => {
      const seedDst = new Uint8Array(32 + 2);
      seedDst.set(seed);
      seedDst[32] = K;
      seedDst[33] = L;
      const [rho, rhoPrime, K_] = seedCoder.decode(shake256(seedDst, { dkLen: seedCoder.bytesLen }));
      const xofPrime = XOF2562(rhoPrime);
      const s1 = [];
      for (let i = 0; i < L; i++)
        s1.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s2 = [];
      for (let i = L; i < L + K; i++)
        s2.push(RejBoundedPoly(xofPrime.get(i & 255, i >> 8 & 255)));
      const s1Hat = s1.map((i) => NTT.encode(i.slice()));
      const t0 = [];
      const t1 = [];
      const xof = XOF1282(rho);
      const t = newPoly(N);
      for (let i = 0; i < K; i++) {
        t.fill(0);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(t, MultiplyNTTs(aij, s1Hat[j]));
        }
        NTT.decode(t);
        const { r0, r1 } = polyPowerRound(polyAdd(t, s2[i]));
        t0.push(r0);
        t1.push(r1);
      }
      const publicKey = publicCoder.encode([rho, t1]);
      const tr = shake256(publicKey, { dkLen: TR_BYTES });
      const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]);
      xof.clean();
      xofPrime.clean();
      cleanBytes(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
      return { publicKey, secretKey };
    }, "keygen"),
    // NOTE: random is optional.
    sign: /* @__PURE__ */ __name((secretKey, msg, random) => {
      const [rho, _K, tr, s1, s2, t0] = secretCoder.decode(secretKey);
      const A = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K; i++) {
        const pv = [];
        for (let j = 0; j < L; j++)
          pv.push(RejNTTPoly(xof.get(j, i)));
        A.push(pv);
      }
      xof.clean();
      for (let i = 0; i < L; i++)
        NTT.encode(s1[i]);
      for (let i = 0; i < K; i++) {
        NTT.encode(s2[i]);
        NTT.encode(t0[i]);
      }
      const mu = shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest();
      const rnd = random ? random : new Uint8Array(32);
      ensureBytes(rnd);
      const rhoprime = shake256.create({ dkLen: CRH_BYTES }).update(_K).update(rnd).update(mu).digest();
      ensureBytes(rhoprime, CRH_BYTES);
      const x256 = XOF2562(rhoprime, ZCoder.bytesLen);
      main_loop: for (let kappa = 0; ; ) {
        const y = [];
        for (let i = 0; i < L; i++, kappa++)
          y.push(ZCoder.decode(x256.get(kappa & 255, kappa >> 8)()));
        const z = y.map((i) => NTT.encode(i.slice()));
        const w = [];
        for (let i = 0; i < K; i++) {
          const wi = newPoly(N);
          for (let j = 0; j < L; j++)
            polyAdd(wi, MultiplyNTTs(A[i][j], z[j]));
          NTT.decode(wi);
          w.push(wi);
        }
        const w1 = w.map((j) => j.map(HighBits));
        const cTilde = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(w1)).digest();
        const cHat = NTT.encode(SampleInBall(cTilde));
        const cs1 = s1.map((i) => MultiplyNTTs(i, cHat));
        for (let i = 0; i < L; i++) {
          polyAdd(NTT.decode(cs1[i]), y[i]);
          if (polyChknorm(cs1[i], GAMMA1 - BETA))
            continue main_loop;
        }
        let cnt = 0;
        const h = [];
        for (let i = 0; i < K; i++) {
          const cs2 = NTT.decode(MultiplyNTTs(s2[i], cHat));
          const r0 = polySub(w[i], cs2).map(LowBits);
          if (polyChknorm(r0, GAMMA2 - BETA))
            continue main_loop;
          const ct0 = NTT.decode(MultiplyNTTs(t0[i], cHat));
          if (polyChknorm(ct0, GAMMA2))
            continue main_loop;
          polyAdd(r0, ct0);
          const hint = polyMakeHint(r0, w1[i]);
          h.push(hint.v);
          cnt += hint.cnt;
        }
        if (cnt > OMEGA)
          continue;
        x256.clean();
        const res = sigCoder.encode([cTilde, cs1, h]);
        cleanBytes(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, mu, s1, s2, t0, ...A);
        return res;
      }
      throw new Error("Unreachable code path reached, report this error");
    }, "sign"),
    verify: /* @__PURE__ */ __name((publicKey, msg, sig) => {
      const [rho, t1] = publicCoder.decode(publicKey);
      const tr = shake256(publicKey, { dkLen: TR_BYTES });
      if (sig.length !== sigCoder.bytesLen)
        return false;
      const [cTilde, z, h] = sigCoder.decode(sig);
      if (h === false)
        return false;
      for (let i = 0; i < L; i++)
        if (polyChknorm(z[i], GAMMA1 - BETA))
          return false;
      const mu = shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest();
      const c = NTT.encode(SampleInBall(cTilde));
      const zNtt = z.map((i) => i.slice());
      for (let i = 0; i < L; i++)
        NTT.encode(zNtt[i]);
      const wTick1 = [];
      const xof = XOF1282(rho);
      for (let i = 0; i < K; i++) {
        const ct12d = MultiplyNTTs(NTT.encode(polyShiftl(t1[i])), c);
        const Az = newPoly(N);
        for (let j = 0; j < L; j++) {
          const aij = RejNTTPoly(xof.get(j, i));
          polyAdd(Az, MultiplyNTTs(aij, zNtt[j]));
        }
        const wApprox = NTT.decode(polySub(Az, ct12d));
        wTick1.push(polyUseHint(wApprox, h[i]));
      }
      xof.clean();
      const c2 = shake256.create({ dkLen: C_TILDE_BYTES }).update(mu).update(W1Vec.encode(wTick1)).digest();
      for (const t of h) {
        const sum = t.reduce((acc, i) => acc + i, 0);
        if (!(sum <= OMEGA))
          return false;
      }
      for (const t of z)
        if (polyChknorm(t, GAMMA1 - BETA))
          return false;
      return equalBytes(cTilde, c2);
    }, "verify")
  };
  const getMessage = /* @__PURE__ */ __name((msg, ctx = EMPTY) => {
    ensureBytes(msg);
    ensureBytes(ctx);
    if (ctx.length > 255)
      throw new Error("context should be less than 255 bytes");
    return concatBytes(new Uint8Array([0, ctx.length]), ctx, msg);
  }, "getMessage");
  return {
    internal,
    keygen: internal.keygen,
    signRandBytes: internal.signRandBytes,
    sign: /* @__PURE__ */ __name((secretKey, msg, ctx = EMPTY, random) => {
      const M = getMessage(msg, ctx);
      const res = internal.sign(secretKey, M, random);
      M.fill(0);
      return res;
    }, "sign"),
    verify: /* @__PURE__ */ __name((publicKey, msg, sig, ctx = EMPTY) => {
      return internal.verify(publicKey, getMessage(msg, ctx), sig);
    }, "verify")
  };
}
var N, Q, ROOT_OF_UNITY, F, D, GAMMA2_1, GAMMA2_2, PARAMS, newPoly, mod, smod, NTT, bitsCoder, id, polyCoder, polyAdd, polySub, polyShiftl, polyChknorm, MultiplyNTTs, EMPTY, ml_dsa44, ml_dsa65, ml_dsa87;
var init_ml_dsa = __esm({
  "node_modules/@noble/post-quantum/esm/ml-dsa.js"() {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    init_sha3();
    init_crystals();
    init_utils3();
    N = 256;
    Q = 8380417;
    ROOT_OF_UNITY = 1753;
    F = 8347681;
    D = 13;
    GAMMA2_1 = Math.floor((Q - 1) / 88) | 0;
    GAMMA2_2 = Math.floor((Q - 1) / 32) | 0;
    PARAMS = {
      2: { K: 4, L: 4, D, GAMMA1: 2 ** 17, GAMMA2: GAMMA2_1, TAU: 39, ETA: 2, OMEGA: 80 },
      3: { K: 6, L: 5, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 49, ETA: 4, OMEGA: 55 },
      5: { K: 8, L: 7, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 60, ETA: 2, OMEGA: 75 }
    };
    newPoly = /* @__PURE__ */ __name((n) => new Int32Array(n), "newPoly");
    ({ mod, smod, NTT, bitsCoder } = genCrystals({
      N,
      Q,
      F,
      ROOT_OF_UNITY,
      newPoly,
      isKyber: false,
      brvBits: 8
    }));
    id = /* @__PURE__ */ __name((n) => n, "id");
    polyCoder = /* @__PURE__ */ __name((d, compress = id, verify = id) => bitsCoder(d, {
      encode: /* @__PURE__ */ __name((i) => compress(verify(i)), "encode"),
      decode: /* @__PURE__ */ __name((i) => verify(compress(i)), "decode")
    }), "polyCoder");
    polyAdd = /* @__PURE__ */ __name((a, b) => {
      for (let i = 0; i < a.length; i++)
        a[i] = mod(a[i] + b[i]);
      return a;
    }, "polyAdd");
    polySub = /* @__PURE__ */ __name((a, b) => {
      for (let i = 0; i < a.length; i++)
        a[i] = mod(a[i] - b[i]);
      return a;
    }, "polySub");
    polyShiftl = /* @__PURE__ */ __name((p) => {
      for (let i = 0; i < N; i++)
        p[i] <<= D;
      return p;
    }, "polyShiftl");
    polyChknorm = /* @__PURE__ */ __name((p, B) => {
      for (let i = 0; i < N; i++)
        if (Math.abs(smod(p[i])) >= B)
          return true;
      return false;
    }, "polyChknorm");
    MultiplyNTTs = /* @__PURE__ */ __name((a, b) => {
      const c = newPoly(N);
      for (let i = 0; i < a.length; i++)
        c[i] = mod(a[i] * b[i]);
      return c;
    }, "MultiplyNTTs");
    __name(RejNTTPoly, "RejNTTPoly");
    EMPTY = new Uint8Array(0);
    __name(getDilithium, "getDilithium");
    ml_dsa44 = /* @__PURE__ */ getDilithium({
      ...PARAMS[2],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 32,
      XOF128,
      XOF256
    });
    ml_dsa65 = /* @__PURE__ */ getDilithium({
      ...PARAMS[3],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 48,
      XOF128,
      XOF256
    });
    ml_dsa87 = /* @__PURE__ */ getDilithium({
      ...PARAMS[5],
      CRH_BYTES: 64,
      TR_BYTES: 64,
      C_TILDE_BYTES: 64,
      XOF128,
      XOF256
    });
  }
});

// node-built-in-modules:crypto
import libDefault from "crypto";
var require_crypto = __commonJS({
  "node-built-in-modules:crypto"(exports, module) {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    module.exports = libDefault;
  }
});

// node_modules/bcryptjs/dist/bcrypt.js
var require_bcrypt = __commonJS({
  "node_modules/bcryptjs/dist/bcrypt.js"(exports, module) {
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_performance2();
    (function(global, factory) {
      if (typeof define === "function" && define["amd"])
        define([], factory);
      else if (typeof __require === "function" && typeof module === "object" && module && module["exports"])
        module["exports"] = factory();
      else
        (global["dcodeIO"] = global["dcodeIO"] || {})["bcrypt"] = factory();
    })(exports, function() {
      "use strict";
      var bcrypt2 = {};
      var randomFallback = null;
      function random(len) {
        if (typeof module !== "undefined" && module && module["exports"])
          try {
            return require_crypto()["randomBytes"](len);
          } catch (e) {
          }
        try {
          var a;
          (self["crypto"] || self["msCrypto"])["getRandomValues"](a = new Uint32Array(len));
          return Array.prototype.slice.call(a);
        } catch (e) {
        }
        if (!randomFallback)
          throw Error("Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative");
        return randomFallback(len);
      }
      __name(random, "random");
      var randomAvailable = false;
      try {
        random(1);
        randomAvailable = true;
      } catch (e) {
      }
      randomFallback = null;
      bcrypt2.setRandomFallback = function(random2) {
        randomFallback = random2;
      };
      bcrypt2.genSaltSync = function(rounds, seed_length) {
        rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof rounds !== "number")
          throw Error("Illegal arguments: " + typeof rounds + ", " + typeof seed_length);
        if (rounds < 4)
          rounds = 4;
        else if (rounds > 31)
          rounds = 31;
        var salt = [];
        salt.push("$2a$");
        if (rounds < 10)
          salt.push("0");
        salt.push(rounds.toString());
        salt.push("$");
        salt.push(base64_encode(random(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
        return salt.join("");
      };
      bcrypt2.genSalt = function(rounds, seed_length, callback) {
        if (typeof seed_length === "function")
          callback = seed_length, seed_length = void 0;
        if (typeof rounds === "function")
          callback = rounds, rounds = void 0;
        if (typeof rounds === "undefined")
          rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
        else if (typeof rounds !== "number")
          throw Error("illegal arguments: " + typeof rounds);
        function _async(callback2) {
          nextTick2(function() {
            try {
              callback2(null, bcrypt2.genSaltSync(rounds));
            } catch (err) {
              callback2(err);
            }
          });
        }
        __name(_async, "_async");
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      bcrypt2.hashSync = function(s, salt) {
        if (typeof salt === "undefined")
          salt = GENSALT_DEFAULT_LOG2_ROUNDS;
        if (typeof salt === "number")
          salt = bcrypt2.genSaltSync(salt);
        if (typeof s !== "string" || typeof salt !== "string")
          throw Error("Illegal arguments: " + typeof s + ", " + typeof salt);
        return _hash(s, salt);
      };
      bcrypt2.hash = function(s, salt, callback, progressCallback) {
        function _async(callback2) {
          if (typeof s === "string" && typeof salt === "number")
            bcrypt2.genSalt(salt, function(err, salt2) {
              _hash(s, salt2, callback2, progressCallback);
            });
          else if (typeof s === "string" && typeof salt === "string")
            _hash(s, salt, callback2, progressCallback);
          else
            nextTick2(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof salt)));
        }
        __name(_async, "_async");
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      function safeStringCompare(known, unknown) {
        var right = 0, wrong = 0;
        for (var i = 0, k = known.length; i < k; ++i) {
          if (known.charCodeAt(i) === unknown.charCodeAt(i))
            ++right;
          else
            ++wrong;
        }
        if (right < 0)
          return false;
        return wrong === 0;
      }
      __name(safeStringCompare, "safeStringCompare");
      bcrypt2.compareSync = function(s, hash) {
        if (typeof s !== "string" || typeof hash !== "string")
          throw Error("Illegal arguments: " + typeof s + ", " + typeof hash);
        if (hash.length !== 60)
          return false;
        return safeStringCompare(bcrypt2.hashSync(s, hash.substr(0, hash.length - 31)), hash);
      };
      bcrypt2.compare = function(s, hash, callback, progressCallback) {
        function _async(callback2) {
          if (typeof s !== "string" || typeof hash !== "string") {
            nextTick2(callback2.bind(this, Error("Illegal arguments: " + typeof s + ", " + typeof hash)));
            return;
          }
          if (hash.length !== 60) {
            nextTick2(callback2.bind(this, null, false));
            return;
          }
          bcrypt2.hash(s, hash.substr(0, 29), function(err, comp) {
            if (err)
              callback2(err);
            else
              callback2(null, safeStringCompare(comp, hash));
          }, progressCallback);
        }
        __name(_async, "_async");
        if (callback) {
          if (typeof callback !== "function")
            throw Error("Illegal callback: " + typeof callback);
          _async(callback);
        } else
          return new Promise(function(resolve, reject) {
            _async(function(err, res) {
              if (err) {
                reject(err);
                return;
              }
              resolve(res);
            });
          });
      };
      bcrypt2.getRounds = function(hash) {
        if (typeof hash !== "string")
          throw Error("Illegal arguments: " + typeof hash);
        return parseInt(hash.split("$")[2], 10);
      };
      bcrypt2.getSalt = function(hash) {
        if (typeof hash !== "string")
          throw Error("Illegal arguments: " + typeof hash);
        if (hash.length !== 60)
          throw Error("Illegal hash length: " + hash.length + " != 60");
        return hash.substring(0, 29);
      };
      var nextTick2 = typeof process !== "undefined" && process && typeof process.nextTick === "function" ? typeof setImmediate === "function" ? setImmediate : process.nextTick : setTimeout;
      function stringToBytes(str) {
        var out = [], i = 0;
        utfx.encodeUTF16toUTF8(function() {
          if (i >= str.length) return null;
          return str.charCodeAt(i++);
        }, function(b) {
          out.push(b);
        });
        return out;
      }
      __name(stringToBytes, "stringToBytes");
      var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
      var BASE64_INDEX = [
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        0,
        1,
        54,
        55,
        56,
        57,
        58,
        59,
        60,
        61,
        62,
        63,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52,
        53,
        -1,
        -1,
        -1,
        -1,
        -1
      ];
      var stringFromCharCode = String.fromCharCode;
      function base64_encode(b, len) {
        var off2 = 0, rs = [], c1, c2;
        if (len <= 0 || len > b.length)
          throw Error("Illegal len: " + len);
        while (off2 < len) {
          c1 = b[off2++] & 255;
          rs.push(BASE64_CODE[c1 >> 2 & 63]);
          c1 = (c1 & 3) << 4;
          if (off2 >= len) {
            rs.push(BASE64_CODE[c1 & 63]);
            break;
          }
          c2 = b[off2++] & 255;
          c1 |= c2 >> 4 & 15;
          rs.push(BASE64_CODE[c1 & 63]);
          c1 = (c2 & 15) << 2;
          if (off2 >= len) {
            rs.push(BASE64_CODE[c1 & 63]);
            break;
          }
          c2 = b[off2++] & 255;
          c1 |= c2 >> 6 & 3;
          rs.push(BASE64_CODE[c1 & 63]);
          rs.push(BASE64_CODE[c2 & 63]);
        }
        return rs.join("");
      }
      __name(base64_encode, "base64_encode");
      function base64_decode(s, len) {
        var off2 = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
        if (len <= 0)
          throw Error("Illegal len: " + len);
        while (off2 < slen - 1 && olen < len) {
          code = s.charCodeAt(off2++);
          c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          code = s.charCodeAt(off2++);
          c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          if (c1 == -1 || c2 == -1)
            break;
          o = c1 << 2 >>> 0;
          o |= (c2 & 48) >> 4;
          rs.push(stringFromCharCode(o));
          if (++olen >= len || off2 >= slen)
            break;
          code = s.charCodeAt(off2++);
          c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          if (c3 == -1)
            break;
          o = (c2 & 15) << 4 >>> 0;
          o |= (c3 & 60) >> 2;
          rs.push(stringFromCharCode(o));
          if (++olen >= len || off2 >= slen)
            break;
          code = s.charCodeAt(off2++);
          c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
          o = (c3 & 3) << 6 >>> 0;
          o |= c4;
          rs.push(stringFromCharCode(o));
          ++olen;
        }
        var res = [];
        for (off2 = 0; off2 < olen; off2++)
          res.push(rs[off2].charCodeAt(0));
        return res;
      }
      __name(base64_decode, "base64_decode");
      var utfx = (function() {
        "use strict";
        var utfx2 = {};
        utfx2.MAX_CODEPOINT = 1114111;
        utfx2.encodeUTF8 = function(src, dst) {
          var cp = null;
          if (typeof src === "number")
            cp = src, src = /* @__PURE__ */ __name(function() {
              return null;
            }, "src");
          while (cp !== null || (cp = src()) !== null) {
            if (cp < 128)
              dst(cp & 127);
            else if (cp < 2048)
              dst(cp >> 6 & 31 | 192), dst(cp & 63 | 128);
            else if (cp < 65536)
              dst(cp >> 12 & 15 | 224), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
            else
              dst(cp >> 18 & 7 | 240), dst(cp >> 12 & 63 | 128), dst(cp >> 6 & 63 | 128), dst(cp & 63 | 128);
            cp = null;
          }
        };
        utfx2.decodeUTF8 = function(src, dst) {
          var a, b, c, d, fail = /* @__PURE__ */ __name(function(b2) {
            b2 = b2.slice(0, b2.indexOf(null));
            var err = Error(b2.toString());
            err.name = "TruncatedError";
            err["bytes"] = b2;
            throw err;
          }, "fail");
          while ((a = src()) !== null) {
            if ((a & 128) === 0)
              dst(a);
            else if ((a & 224) === 192)
              (b = src()) === null && fail([a, b]), dst((a & 31) << 6 | b & 63);
            else if ((a & 240) === 224)
              ((b = src()) === null || (c = src()) === null) && fail([a, b, c]), dst((a & 15) << 12 | (b & 63) << 6 | c & 63);
            else if ((a & 248) === 240)
              ((b = src()) === null || (c = src()) === null || (d = src()) === null) && fail([a, b, c, d]), dst((a & 7) << 18 | (b & 63) << 12 | (c & 63) << 6 | d & 63);
            else throw RangeError("Illegal starting byte: " + a);
          }
        };
        utfx2.UTF16toUTF8 = function(src, dst) {
          var c1, c2 = null;
          while (true) {
            if ((c1 = c2 !== null ? c2 : src()) === null)
              break;
            if (c1 >= 55296 && c1 <= 57343) {
              if ((c2 = src()) !== null) {
                if (c2 >= 56320 && c2 <= 57343) {
                  dst((c1 - 55296) * 1024 + c2 - 56320 + 65536);
                  c2 = null;
                  continue;
                }
              }
            }
            dst(c1);
          }
          if (c2 !== null) dst(c2);
        };
        utfx2.UTF8toUTF16 = function(src, dst) {
          var cp = null;
          if (typeof src === "number")
            cp = src, src = /* @__PURE__ */ __name(function() {
              return null;
            }, "src");
          while (cp !== null || (cp = src()) !== null) {
            if (cp <= 65535)
              dst(cp);
            else
              cp -= 65536, dst((cp >> 10) + 55296), dst(cp % 1024 + 56320);
            cp = null;
          }
        };
        utfx2.encodeUTF16toUTF8 = function(src, dst) {
          utfx2.UTF16toUTF8(src, function(cp) {
            utfx2.encodeUTF8(cp, dst);
          });
        };
        utfx2.decodeUTF8toUTF16 = function(src, dst) {
          utfx2.decodeUTF8(src, function(cp) {
            utfx2.UTF8toUTF16(cp, dst);
          });
        };
        utfx2.calculateCodePoint = function(cp) {
          return cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4;
        };
        utfx2.calculateUTF8 = function(src) {
          var cp, l = 0;
          while ((cp = src()) !== null)
            l += utfx2.calculateCodePoint(cp);
          return l;
        };
        utfx2.calculateUTF16asUTF8 = function(src) {
          var n = 0, l = 0;
          utfx2.UTF16toUTF8(src, function(cp) {
            ++n;
            l += utfx2.calculateCodePoint(cp);
          });
          return [n, l];
        };
        return utfx2;
      })();
      Date.now = Date.now || function() {
        return +/* @__PURE__ */ new Date();
      };
      var BCRYPT_SALT_LEN = 16;
      var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
      var BLOWFISH_NUM_ROUNDS = 16;
      var MAX_EXECUTION_TIME = 100;
      var P_ORIG = [
        608135816,
        2242054355,
        320440878,
        57701188,
        2752067618,
        698298832,
        137296536,
        3964562569,
        1160258022,
        953160567,
        3193202383,
        887688300,
        3232508343,
        3380367581,
        1065670069,
        3041331479,
        2450970073,
        2306472731
      ];
      var S_ORIG = [
        3509652390,
        2564797868,
        805139163,
        3491422135,
        3101798381,
        1780907670,
        3128725573,
        4046225305,
        614570311,
        3012652279,
        134345442,
        2240740374,
        1667834072,
        1901547113,
        2757295779,
        4103290238,
        227898511,
        1921955416,
        1904987480,
        2182433518,
        2069144605,
        3260701109,
        2620446009,
        720527379,
        3318853667,
        677414384,
        3393288472,
        3101374703,
        2390351024,
        1614419982,
        1822297739,
        2954791486,
        3608508353,
        3174124327,
        2024746970,
        1432378464,
        3864339955,
        2857741204,
        1464375394,
        1676153920,
        1439316330,
        715854006,
        3033291828,
        289532110,
        2706671279,
        2087905683,
        3018724369,
        1668267050,
        732546397,
        1947742710,
        3462151702,
        2609353502,
        2950085171,
        1814351708,
        2050118529,
        680887927,
        999245976,
        1800124847,
        3300911131,
        1713906067,
        1641548236,
        4213287313,
        1216130144,
        1575780402,
        4018429277,
        3917837745,
        3693486850,
        3949271944,
        596196993,
        3549867205,
        258830323,
        2213823033,
        772490370,
        2760122372,
        1774776394,
        2652871518,
        566650946,
        4142492826,
        1728879713,
        2882767088,
        1783734482,
        3629395816,
        2517608232,
        2874225571,
        1861159788,
        326777828,
        3124490320,
        2130389656,
        2716951837,
        967770486,
        1724537150,
        2185432712,
        2364442137,
        1164943284,
        2105845187,
        998989502,
        3765401048,
        2244026483,
        1075463327,
        1455516326,
        1322494562,
        910128902,
        469688178,
        1117454909,
        936433444,
        3490320968,
        3675253459,
        1240580251,
        122909385,
        2157517691,
        634681816,
        4142456567,
        3825094682,
        3061402683,
        2540495037,
        79693498,
        3249098678,
        1084186820,
        1583128258,
        426386531,
        1761308591,
        1047286709,
        322548459,
        995290223,
        1845252383,
        2603652396,
        3431023940,
        2942221577,
        3202600964,
        3727903485,
        1712269319,
        422464435,
        3234572375,
        1170764815,
        3523960633,
        3117677531,
        1434042557,
        442511882,
        3600875718,
        1076654713,
        1738483198,
        4213154764,
        2393238008,
        3677496056,
        1014306527,
        4251020053,
        793779912,
        2902807211,
        842905082,
        4246964064,
        1395751752,
        1040244610,
        2656851899,
        3396308128,
        445077038,
        3742853595,
        3577915638,
        679411651,
        2892444358,
        2354009459,
        1767581616,
        3150600392,
        3791627101,
        3102740896,
        284835224,
        4246832056,
        1258075500,
        768725851,
        2589189241,
        3069724005,
        3532540348,
        1274779536,
        3789419226,
        2764799539,
        1660621633,
        3471099624,
        4011903706,
        913787905,
        3497959166,
        737222580,
        2514213453,
        2928710040,
        3937242737,
        1804850592,
        3499020752,
        2949064160,
        2386320175,
        2390070455,
        2415321851,
        4061277028,
        2290661394,
        2416832540,
        1336762016,
        1754252060,
        3520065937,
        3014181293,
        791618072,
        3188594551,
        3933548030,
        2332172193,
        3852520463,
        3043980520,
        413987798,
        3465142937,
        3030929376,
        4245938359,
        2093235073,
        3534596313,
        375366246,
        2157278981,
        2479649556,
        555357303,
        3870105701,
        2008414854,
        3344188149,
        4221384143,
        3956125452,
        2067696032,
        3594591187,
        2921233993,
        2428461,
        544322398,
        577241275,
        1471733935,
        610547355,
        4027169054,
        1432588573,
        1507829418,
        2025931657,
        3646575487,
        545086370,
        48609733,
        2200306550,
        1653985193,
        298326376,
        1316178497,
        3007786442,
        2064951626,
        458293330,
        2589141269,
        3591329599,
        3164325604,
        727753846,
        2179363840,
        146436021,
        1461446943,
        4069977195,
        705550613,
        3059967265,
        3887724982,
        4281599278,
        3313849956,
        1404054877,
        2845806497,
        146425753,
        1854211946,
        1266315497,
        3048417604,
        3681880366,
        3289982499,
        290971e4,
        1235738493,
        2632868024,
        2414719590,
        3970600049,
        1771706367,
        1449415276,
        3266420449,
        422970021,
        1963543593,
        2690192192,
        3826793022,
        1062508698,
        1531092325,
        1804592342,
        2583117782,
        2714934279,
        4024971509,
        1294809318,
        4028980673,
        1289560198,
        2221992742,
        1669523910,
        35572830,
        157838143,
        1052438473,
        1016535060,
        1802137761,
        1753167236,
        1386275462,
        3080475397,
        2857371447,
        1040679964,
        2145300060,
        2390574316,
        1461121720,
        2956646967,
        4031777805,
        4028374788,
        33600511,
        2920084762,
        1018524850,
        629373528,
        3691585981,
        3515945977,
        2091462646,
        2486323059,
        586499841,
        988145025,
        935516892,
        3367335476,
        2599673255,
        2839830854,
        265290510,
        3972581182,
        2759138881,
        3795373465,
        1005194799,
        847297441,
        406762289,
        1314163512,
        1332590856,
        1866599683,
        4127851711,
        750260880,
        613907577,
        1450815602,
        3165620655,
        3734664991,
        3650291728,
        3012275730,
        3704569646,
        1427272223,
        778793252,
        1343938022,
        2676280711,
        2052605720,
        1946737175,
        3164576444,
        3914038668,
        3967478842,
        3682934266,
        1661551462,
        3294938066,
        4011595847,
        840292616,
        3712170807,
        616741398,
        312560963,
        711312465,
        1351876610,
        322626781,
        1910503582,
        271666773,
        2175563734,
        1594956187,
        70604529,
        3617834859,
        1007753275,
        1495573769,
        4069517037,
        2549218298,
        2663038764,
        504708206,
        2263041392,
        3941167025,
        2249088522,
        1514023603,
        1998579484,
        1312622330,
        694541497,
        2582060303,
        2151582166,
        1382467621,
        776784248,
        2618340202,
        3323268794,
        2497899128,
        2784771155,
        503983604,
        4076293799,
        907881277,
        423175695,
        432175456,
        1378068232,
        4145222326,
        3954048622,
        3938656102,
        3820766613,
        2793130115,
        2977904593,
        26017576,
        3274890735,
        3194772133,
        1700274565,
        1756076034,
        4006520079,
        3677328699,
        720338349,
        1533947780,
        354530856,
        688349552,
        3973924725,
        1637815568,
        332179504,
        3949051286,
        53804574,
        2852348879,
        3044236432,
        1282449977,
        3583942155,
        3416972820,
        4006381244,
        1617046695,
        2628476075,
        3002303598,
        1686838959,
        431878346,
        2686675385,
        1700445008,
        1080580658,
        1009431731,
        832498133,
        3223435511,
        2605976345,
        2271191193,
        2516031870,
        1648197032,
        4164389018,
        2548247927,
        300782431,
        375919233,
        238389289,
        3353747414,
        2531188641,
        2019080857,
        1475708069,
        455242339,
        2609103871,
        448939670,
        3451063019,
        1395535956,
        2413381860,
        1841049896,
        1491858159,
        885456874,
        4264095073,
        4001119347,
        1565136089,
        3898914787,
        1108368660,
        540939232,
        1173283510,
        2745871338,
        3681308437,
        4207628240,
        3343053890,
        4016749493,
        1699691293,
        1103962373,
        3625875870,
        2256883143,
        3830138730,
        1031889488,
        3479347698,
        1535977030,
        4236805024,
        3251091107,
        2132092099,
        1774941330,
        1199868427,
        1452454533,
        157007616,
        2904115357,
        342012276,
        595725824,
        1480756522,
        206960106,
        497939518,
        591360097,
        863170706,
        2375253569,
        3596610801,
        1814182875,
        2094937945,
        3421402208,
        1082520231,
        3463918190,
        2785509508,
        435703966,
        3908032597,
        1641649973,
        2842273706,
        3305899714,
        1510255612,
        2148256476,
        2655287854,
        3276092548,
        4258621189,
        236887753,
        3681803219,
        274041037,
        1734335097,
        3815195456,
        3317970021,
        1899903192,
        1026095262,
        4050517792,
        356393447,
        2410691914,
        3873677099,
        3682840055,
        3913112168,
        2491498743,
        4132185628,
        2489919796,
        1091903735,
        1979897079,
        3170134830,
        3567386728,
        3557303409,
        857797738,
        1136121015,
        1342202287,
        507115054,
        2535736646,
        337727348,
        3213592640,
        1301675037,
        2528481711,
        1895095763,
        1721773893,
        3216771564,
        62756741,
        2142006736,
        835421444,
        2531993523,
        1442658625,
        3659876326,
        2882144922,
        676362277,
        1392781812,
        170690266,
        3921047035,
        1759253602,
        3611846912,
        1745797284,
        664899054,
        1329594018,
        3901205900,
        3045908486,
        2062866102,
        2865634940,
        3543621612,
        3464012697,
        1080764994,
        553557557,
        3656615353,
        3996768171,
        991055499,
        499776247,
        1265440854,
        648242737,
        3940784050,
        980351604,
        3713745714,
        1749149687,
        3396870395,
        4211799374,
        3640570775,
        1161844396,
        3125318951,
        1431517754,
        545492359,
        4268468663,
        3499529547,
        1437099964,
        2702547544,
        3433638243,
        2581715763,
        2787789398,
        1060185593,
        1593081372,
        2418618748,
        4260947970,
        69676912,
        2159744348,
        86519011,
        2512459080,
        3838209314,
        1220612927,
        3339683548,
        133810670,
        1090789135,
        1078426020,
        1569222167,
        845107691,
        3583754449,
        4072456591,
        1091646820,
        628848692,
        1613405280,
        3757631651,
        526609435,
        236106946,
        48312990,
        2942717905,
        3402727701,
        1797494240,
        859738849,
        992217954,
        4005476642,
        2243076622,
        3870952857,
        3732016268,
        765654824,
        3490871365,
        2511836413,
        1685915746,
        3888969200,
        1414112111,
        2273134842,
        3281911079,
        4080962846,
        172450625,
        2569994100,
        980381355,
        4109958455,
        2819808352,
        2716589560,
        2568741196,
        3681446669,
        3329971472,
        1835478071,
        660984891,
        3704678404,
        4045999559,
        3422617507,
        3040415634,
        1762651403,
        1719377915,
        3470491036,
        2693910283,
        3642056355,
        3138596744,
        1364962596,
        2073328063,
        1983633131,
        926494387,
        3423689081,
        2150032023,
        4096667949,
        1749200295,
        3328846651,
        309677260,
        2016342300,
        1779581495,
        3079819751,
        111262694,
        1274766160,
        443224088,
        298511866,
        1025883608,
        3806446537,
        1145181785,
        168956806,
        3641502830,
        3584813610,
        1689216846,
        3666258015,
        3200248200,
        1692713982,
        2646376535,
        4042768518,
        1618508792,
        1610833997,
        3523052358,
        4130873264,
        2001055236,
        3610705100,
        2202168115,
        4028541809,
        2961195399,
        1006657119,
        2006996926,
        3186142756,
        1430667929,
        3210227297,
        1314452623,
        4074634658,
        4101304120,
        2273951170,
        1399257539,
        3367210612,
        3027628629,
        1190975929,
        2062231137,
        2333990788,
        2221543033,
        2438960610,
        1181637006,
        548689776,
        2362791313,
        3372408396,
        3104550113,
        3145860560,
        296247880,
        1970579870,
        3078560182,
        3769228297,
        1714227617,
        3291629107,
        3898220290,
        166772364,
        1251581989,
        493813264,
        448347421,
        195405023,
        2709975567,
        677966185,
        3703036547,
        1463355134,
        2715995803,
        1338867538,
        1343315457,
        2802222074,
        2684532164,
        233230375,
        2599980071,
        2000651841,
        3277868038,
        1638401717,
        4028070440,
        3237316320,
        6314154,
        819756386,
        300326615,
        590932579,
        1405279636,
        3267499572,
        3150704214,
        2428286686,
        3959192993,
        3461946742,
        1862657033,
        1266418056,
        963775037,
        2089974820,
        2263052895,
        1917689273,
        448879540,
        3550394620,
        3981727096,
        150775221,
        3627908307,
        1303187396,
        508620638,
        2975983352,
        2726630617,
        1817252668,
        1876281319,
        1457606340,
        908771278,
        3720792119,
        3617206836,
        2455994898,
        1729034894,
        1080033504,
        976866871,
        3556439503,
        2881648439,
        1522871579,
        1555064734,
        1336096578,
        3548522304,
        2579274686,
        3574697629,
        3205460757,
        3593280638,
        3338716283,
        3079412587,
        564236357,
        2993598910,
        1781952180,
        1464380207,
        3163844217,
        3332601554,
        1699332808,
        1393555694,
        1183702653,
        3581086237,
        1288719814,
        691649499,
        2847557200,
        2895455976,
        3193889540,
        2717570544,
        1781354906,
        1676643554,
        2592534050,
        3230253752,
        1126444790,
        2770207658,
        2633158820,
        2210423226,
        2615765581,
        2414155088,
        3127139286,
        673620729,
        2805611233,
        1269405062,
        4015350505,
        3341807571,
        4149409754,
        1057255273,
        2012875353,
        2162469141,
        2276492801,
        2601117357,
        993977747,
        3918593370,
        2654263191,
        753973209,
        36408145,
        2530585658,
        25011837,
        3520020182,
        2088578344,
        530523599,
        2918365339,
        1524020338,
        1518925132,
        3760827505,
        3759777254,
        1202760957,
        3985898139,
        3906192525,
        674977740,
        4174734889,
        2031300136,
        2019492241,
        3983892565,
        4153806404,
        3822280332,
        352677332,
        2297720250,
        60907813,
        90501309,
        3286998549,
        1016092578,
        2535922412,
        2839152426,
        457141659,
        509813237,
        4120667899,
        652014361,
        1966332200,
        2975202805,
        55981186,
        2327461051,
        676427537,
        3255491064,
        2882294119,
        3433927263,
        1307055953,
        942726286,
        933058658,
        2468411793,
        3933900994,
        4215176142,
        1361170020,
        2001714738,
        2830558078,
        3274259782,
        1222529897,
        1679025792,
        2729314320,
        3714953764,
        1770335741,
        151462246,
        3013232138,
        1682292957,
        1483529935,
        471910574,
        1539241949,
        458788160,
        3436315007,
        1807016891,
        3718408830,
        978976581,
        1043663428,
        3165965781,
        1927990952,
        4200891579,
        2372276910,
        3208408903,
        3533431907,
        1412390302,
        2931980059,
        4132332400,
        1947078029,
        3881505623,
        4168226417,
        2941484381,
        1077988104,
        1320477388,
        886195818,
        18198404,
        3786409e3,
        2509781533,
        112762804,
        3463356488,
        1866414978,
        891333506,
        18488651,
        661792760,
        1628790961,
        3885187036,
        3141171499,
        876946877,
        2693282273,
        1372485963,
        791857591,
        2686433993,
        3759982718,
        3167212022,
        3472953795,
        2716379847,
        445679433,
        3561995674,
        3504004811,
        3574258232,
        54117162,
        3331405415,
        2381918588,
        3769707343,
        4154350007,
        1140177722,
        4074052095,
        668550556,
        3214352940,
        367459370,
        261225585,
        2610173221,
        4209349473,
        3468074219,
        3265815641,
        314222801,
        3066103646,
        3808782860,
        282218597,
        3406013506,
        3773591054,
        379116347,
        1285071038,
        846784868,
        2669647154,
        3771962079,
        3550491691,
        2305946142,
        453669953,
        1268987020,
        3317592352,
        3279303384,
        3744833421,
        2610507566,
        3859509063,
        266596637,
        3847019092,
        517658769,
        3462560207,
        3443424879,
        370717030,
        4247526661,
        2224018117,
        4143653529,
        4112773975,
        2788324899,
        2477274417,
        1456262402,
        2901442914,
        1517677493,
        1846949527,
        2295493580,
        3734397586,
        2176403920,
        1280348187,
        1908823572,
        3871786941,
        846861322,
        1172426758,
        3287448474,
        3383383037,
        1655181056,
        3139813346,
        901632758,
        1897031941,
        2986607138,
        3066810236,
        3447102507,
        1393639104,
        373351379,
        950779232,
        625454576,
        3124240540,
        4148612726,
        2007998917,
        544563296,
        2244738638,
        2330496472,
        2058025392,
        1291430526,
        424198748,
        50039436,
        29584100,
        3605783033,
        2429876329,
        2791104160,
        1057563949,
        3255363231,
        3075367218,
        3463963227,
        1469046755,
        985887462
      ];
      var C_ORIG = [
        1332899944,
        1700884034,
        1701343084,
        1684370003,
        1668446532,
        1869963892
      ];
      function _encipher(lr, off2, P, S) {
        var n, l = lr[off2], r = lr[off2 + 1];
        l ^= P[0];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[1];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[2];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[3];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[4];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[5];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[6];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[7];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[8];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[9];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[10];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[11];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[12];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[13];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[14];
        n = S[l >>> 24];
        n += S[256 | l >> 16 & 255];
        n ^= S[512 | l >> 8 & 255];
        n += S[768 | l & 255];
        r ^= n ^ P[15];
        n = S[r >>> 24];
        n += S[256 | r >> 16 & 255];
        n ^= S[512 | r >> 8 & 255];
        n += S[768 | r & 255];
        l ^= n ^ P[16];
        lr[off2] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
        lr[off2 + 1] = l;
        return lr;
      }
      __name(_encipher, "_encipher");
      function _streamtoword(data, offp) {
        for (var i = 0, word = 0; i < 4; ++i)
          word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
        return { key: word, offp };
      }
      __name(_streamtoword, "_streamtoword");
      function _key(key, P, S) {
        var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
        for (var i = 0; i < plen; i++)
          sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
        for (i = 0; i < plen; i += 2)
          lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
          lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
      }
      __name(_key, "_key");
      function _ekskey(data, key, P, S) {
        var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
        for (var i = 0; i < plen; i++)
          sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
        offp = 0;
        for (i = 0; i < plen; i += 2)
          sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
        for (i = 0; i < slen; i += 2)
          sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
      }
      __name(_ekskey, "_ekskey");
      function _crypt(b, salt, rounds, callback, progressCallback) {
        var cdata = C_ORIG.slice(), clen = cdata.length, err;
        if (rounds < 4 || rounds > 31) {
          err = Error("Illegal number of rounds (4-31): " + rounds);
          if (callback) {
            nextTick2(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        if (salt.length !== BCRYPT_SALT_LEN) {
          err = Error("Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN);
          if (callback) {
            nextTick2(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        rounds = 1 << rounds >>> 0;
        var P, S, i = 0, j;
        if (Int32Array) {
          P = new Int32Array(P_ORIG);
          S = new Int32Array(S_ORIG);
        } else {
          P = P_ORIG.slice();
          S = S_ORIG.slice();
        }
        _ekskey(salt, b, P, S);
        function next() {
          if (progressCallback)
            progressCallback(i / rounds);
          if (i < rounds) {
            var start = Date.now();
            for (; i < rounds; ) {
              i = i + 1;
              _key(b, P, S);
              _key(salt, P, S);
              if (Date.now() - start > MAX_EXECUTION_TIME)
                break;
            }
          } else {
            for (i = 0; i < 64; i++)
              for (j = 0; j < clen >> 1; j++)
                _encipher(cdata, j << 1, P, S);
            var ret = [];
            for (i = 0; i < clen; i++)
              ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
            if (callback) {
              callback(null, ret);
              return;
            } else
              return ret;
          }
          if (callback)
            nextTick2(next);
        }
        __name(next, "next");
        if (typeof callback !== "undefined") {
          next();
        } else {
          var res;
          while (true)
            if (typeof (res = next()) !== "undefined")
              return res || [];
        }
      }
      __name(_crypt, "_crypt");
      function _hash(s, salt, callback, progressCallback) {
        var err;
        if (typeof s !== "string" || typeof salt !== "string") {
          err = Error("Invalid string / salt: Not a string");
          if (callback) {
            nextTick2(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        var minor, offset;
        if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
          err = Error("Invalid salt version: " + salt.substring(0, 2));
          if (callback) {
            nextTick2(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        if (salt.charAt(2) === "$")
          minor = String.fromCharCode(0), offset = 3;
        else {
          minor = salt.charAt(2);
          if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
            err = Error("Invalid salt revision: " + salt.substring(2, 4));
            if (callback) {
              nextTick2(callback.bind(this, err));
              return;
            } else
              throw err;
          }
          offset = 4;
        }
        if (salt.charAt(offset + 2) > "$") {
          err = Error("Missing salt rounds");
          if (callback) {
            nextTick2(callback.bind(this, err));
            return;
          } else
            throw err;
        }
        var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
        s += minor >= "a" ? "\0" : "";
        var passwordb = stringToBytes(s), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
        function finish(bytes) {
          var res = [];
          res.push("$2");
          if (minor >= "a")
            res.push(minor);
          res.push("$");
          if (rounds < 10)
            res.push("0");
          res.push(rounds.toString());
          res.push("$");
          res.push(base64_encode(saltb, saltb.length));
          res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
          return res.join("");
        }
        __name(finish, "finish");
        if (typeof callback == "undefined")
          return finish(_crypt(passwordb, saltb, rounds));
        else {
          _crypt(passwordb, saltb, rounds, function(err2, bytes) {
            if (err2)
              callback(err2, null);
            else
              callback(null, finish(bytes));
          }, progressCallback);
        }
      }
      __name(_hash, "_hash");
      bcrypt2.encodeBase64 = base64_encode;
      bcrypt2.decodeBase64 = base64_decode;
      return bcrypt2;
    });
  }
});

// src/index.js
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();

// src/license.js
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();

// src/hmac-auth.js
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();
async function verifyLicenseHMAC(request, body, env2) {
  try {
    const signature = request.headers.get("X-Khepra-Signature");
    const timestamp = request.headers.get("X-Khepra-Timestamp");
    if (!signature || !timestamp) {
      return {
        valid: false,
        error: "Missing HMAC authentication headers (X-Khepra-Signature, X-Khepra-Timestamp)"
      };
    }
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return {
        valid: false,
        error: "Invalid JSON request body"
      };
    }
    const { machine_id } = parsedBody;
    if (!machine_id) {
      return {
        valid: false,
        error: "Missing machine_id in request body"
      };
    }
    const now = Math.floor(Date.now() / 1e3);
    const requestTime = Number.parseInt(timestamp, 10);
    if (Number.isNaN(requestTime)) {
      return {
        valid: false,
        error: "Invalid timestamp format"
      };
    }
    const timeDiff = Math.abs(now - requestTime);
    if (timeDiff > 300) {
      return {
        valid: false,
        error: "Request timestamp expired (must be within 5 minutes)"
      };
    }
    const license = await env2.DB.prepare(`
			SELECT machine_id, api_key FROM licenses
			WHERE machine_id = ? AND revoked = 0
		`).bind(machine_id).first();
    if (!license?.api_key) {
      if (parsedBody.enrollment_token) {
        return await verifyEnrollmentHMAC(signature, timestamp, body, parsedBody.enrollment_token, env2);
      }
      return {
        valid: false,
        error: "Machine not registered or missing API key"
      };
    }
    const message = `${machine_id}.${timestamp}.${body}`;
    const valid = await verifyHMAC(message, license.api_key, signature);
    if (!valid) {
      return {
        valid: false,
        error: "Invalid HMAC signature"
      };
    }
    return {
      valid: true,
      machineId: machine_id
    };
  } catch (error) {
    console.error("HMAC verification error:", error);
    return {
      valid: false,
      error: "HMAC verification failed [v9]"
    };
  }
}
__name(verifyLicenseHMAC, "verifyLicenseHMAC");
async function verifyEnrollmentHMAC(signature, timestamp, body, enrollmentToken, env2) {
  try {
    const enrollment = await env2.DB.prepare(`
			SELECT token, active FROM enrollment_tokens
			WHERE token = ? AND active = 1
		`).bind(enrollmentToken).first();
    if (!enrollment) {
      return {
        valid: false,
        error: "Invalid enrollment token"
      };
    }
    const parsedBody = JSON.parse(body);
    const message = `${parsedBody.machine_id}.${timestamp}.${body}`;
    const valid = await verifyHMAC(message, enrollmentToken, signature);
    if (!valid) {
      return {
        valid: false,
        error: "Invalid enrollment HMAC signature"
      };
    }
    return {
      valid: true,
      machineId: parsedBody.machine_id
    };
  } catch (error) {
    console.error("Enrollment HMAC verification error:", error);
    return {
      valid: false,
      error: "Enrollment HMAC verification failed"
    };
  }
}
__name(verifyEnrollmentHMAC, "verifyEnrollmentHMAC");
async function verifyHMAC(message, secret, hexSig) {
  let expectedHex;
  try {
    const nc = await import("node:crypto");
    expectedHex = nc.createHmac("sha256", secret).update(message, "utf8").digest("hex");
  } catch (importError) {
    console.error("node:crypto import failed, falling back to WebCrypto:", importError);
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const buf = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message));
    expectedHex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  if (!hexSig || !expectedHex || hexSig.length !== expectedHex.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.codePointAt(i) ^ hexSig.codePointAt(i);
  }
  return diff === 0;
}
__name(verifyHMAC, "verifyHMAC");
async function generateAPIKey() {
  const nc = await import("node:crypto");
  const randomBytes3 = nc.randomBytes(32);
  const apiKey = "khepra_" + randomBytes3.toString("hex");
  return { apiKey };
}
__name(generateAPIKey, "generateAPIKey");

// src/license.js
async function handleLicenseValidate(request, env2, corsHeaders) {
  try {
    const { machine_id, signature, version: version2, installation_id } = await request.json();
    if (!machine_id || !signature) {
      return new Response(JSON.stringify({
        valid: false,
        error: "Missing required fields: machine_id, signature"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const signatureValid = await verifySignature(env2, machine_id, signature);
    if (!signatureValid) {
      return new Response(JSON.stringify({
        valid: false,
        error: "Invalid cryptographic signature",
        message: "License validation requires valid Dilithium3 signature"
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const license = await getLicenseFromDB(env2, machine_id);
    if (!license) {
      return new Response(JSON.stringify({
        valid: false,
        error: "License not found",
        message: "No active license for this installation. Contact support@souhimbou.ai",
        fallback_available: true,
        fallback_features: ["community_edition", "basic_crypto"]
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const now = Math.floor(Date.now() / 1e3);
    if (license.expires_at && license.expires_at < now) {
      return new Response(JSON.stringify({
        valid: false,
        error: "License expired",
        expired_at: new Date(license.expires_at * 1e3).toISOString(),
        message: "License expired. Contact souhimbou.d.kone.mil@army.mil for renewal",
        fallback_available: true
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await logValidationResult(env2, machine_id, "success", { version: version2, installation_id });
    return new Response(JSON.stringify({
      valid: true,
      features: JSON.parse(license.features || "[]"),
      license_tier: license.license_tier,
      organization: license.organization,
      expires_at: license.expires_at ? new Date(license.expires_at * 1e3).toISOString() : null,
      issued_at: new Date(license.issued_at * 1e3).toISOString(),
      validated_at: new Date(now * 1e3).toISOString(),
      limits: {
        max_devices: license.max_devices,
        max_concurrent_scans: license.max_concurrent_scans,
        retention_days: license.retention_days,
        ai_credits_monthly: license.ai_credits_monthly
      },
      validation_server: "telemetry.souhimbou.org",
      client_country: request.cf?.country || "UNKNOWN",
      legal_notice: "This software contains proprietary algorithms protected under 18 U.S.C. \xA7 1831-1839. Unauthorized use prohibited."
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("License validation error:", error);
    await logValidationResult(env2, "error-unknown", "error", { error_message: error.message, version: "unknown" });
    return new Response(JSON.stringify({
      valid: false,
      error: "License validation service unavailable",
      message: "Please try again later or contact support@souhimbou.ai",
      fallback_available: true
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
__name(handleLicenseValidate, "handleLicenseValidate");
async function handleLicenseHeartbeat(request, env2, corsHeaders) {
  try {
    const body = await request.text();
    const authResult = await verifyLicenseHMAC(request, body, env2);
    if (!authResult.valid) {
      console.error("Heartbeat authentication failed:", authResult.error);
      return new Response(JSON.stringify({
        error: "Authentication required",
        message: "Heartbeats require HMAC authentication",
        help: "Include X-Khepra-Signature and X-Khepra-Timestamp headers. See documentation for details."
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { machine_id, status_data } = JSON.parse(body);
    if (!machine_id) {
      return new Response(JSON.stringify({
        error: "Missing machine_id"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const license = await env2.DB.prepare(`
			SELECT revoked, expires_at FROM licenses WHERE machine_id = ?
		`).bind(machine_id).first();
    if (!license || license.revoked === 1) {
      return new Response(JSON.stringify({
        status: "revoked",
        action: "disable_premium_features",
        message: "License has been revoked. Premium features will be disabled."
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const now = Math.floor(Date.now() / 1e3);
    if (license.expires_at && license.expires_at < now) {
      return new Response(JSON.stringify({
        status: "expired",
        action: "disable_premium_features",
        message: "License expired. Contact support for renewal."
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    await env2.DB.prepare(`
			INSERT INTO license_heartbeats (
				machine_id, timestamp, status_data
			) VALUES (?, ?, ?)
		`).bind(
      machine_id,
      now,
      JSON.stringify(status_data || {})
    ).run();
    await env2.DB.prepare(`
			UPDATE licenses SET last_heartbeat = ? WHERE machine_id = ?
		`).bind(now, machine_id).run();
    return new Response(JSON.stringify({
      status: "active",
      next_heartbeat_in: 3600,
      // 1 hour
      timestamp: now
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return new Response(JSON.stringify({
      error: "Heartbeat failed",
      fallback_to_community: true
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleLicenseHeartbeat, "handleLicenseHeartbeat");
async function handleLicenseRevoke(request, env2, corsHeaders, machineId, admin) {
  try {
    const result = await env2.DB.prepare(`
			UPDATE licenses
			SET revoked = 1, revoked_at = ?, revoked_reason = ?
			WHERE machine_id = ?
		`).bind(
      Math.floor(Date.now() / 1e3),
      "Manual revocation",
      machineId
    ).run();
    if (result.changes === 0) {
      return new Response(JSON.stringify({
        error: "License not found"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    await env2.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'revoke', ?, ?, ?)
		`).bind(
      machineId,
      Math.floor(Date.now() / 1e3),
      "License revoked via API",
      admin?.username || "unknown"
    ).run();
    return new Response(JSON.stringify({
      status: "revoked",
      machine_id: machineId,
      timestamp: Date.now()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Revocation error:", error);
    return new Response(JSON.stringify({
      error: "Revocation failed"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleLicenseRevoke, "handleLicenseRevoke");
async function handleLicenseRegister(request, env2, corsHeaders) {
  try {
    const body = await request.text();
    const authResult = await verifyLicenseHMAC(request, body, env2);
    if (!authResult.valid) {
      console.error("Registration authentication failed:", authResult.error);
      return new Response(JSON.stringify({
        error: "Authentication required",
        hmac_error: authResult.error,
        message: "Registration requires HMAC authentication",
        help: "Include X-Khepra-Signature (HMAC using enrollment token) and X-Khepra-Timestamp headers."
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { machine_id, enrollment_token, hostname, platform: platform2, agent_version } = JSON.parse(body);
    if (!machine_id || !enrollment_token) {
      return new Response(JSON.stringify({
        error: "Missing required fields: machine_id, enrollment_token",
        help: "Get your enrollment token from the SouHimBou.ai dashboard"
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!enrollment_token.startsWith("khepra-enroll-")) {
      return new Response(JSON.stringify({
        error: "Invalid enrollment token format",
        help: 'Enrollment tokens start with "khepra-enroll-"'
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const enrollment = await getEnrollmentToken(env2, enrollment_token);
    if (!enrollment) {
      return new Response(JSON.stringify({
        error: "Invalid or expired enrollment token",
        message: "Contact your administrator for a new enrollment token"
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const now = Math.floor(Date.now() / 1e3);
    if (enrollment.expires_at && enrollment.expires_at < now) {
      return new Response(JSON.stringify({
        error: "Enrollment token expired",
        expired_at: new Date(enrollment.expires_at * 1e3).toISOString()
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (enrollment.max_registrations > 0 && enrollment.current_registrations >= enrollment.max_registrations) {
      return new Response(JSON.stringify({
        error: "Registration limit reached",
        max_registrations: enrollment.max_registrations,
        message: "Contact your administrator to increase the limit"
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const existingLicense = await checkExistingLicense(env2, machine_id);
    if (existingLicense?.revoked === 0) {
      return new Response(JSON.stringify({
        status: "already_registered",
        machine_id,
        organization: enrollment.organization,
        features: JSON.parse(existingLicense.features || "[]"),
        license_tier: existingLicense.license_tier,
        expires_at: existingLicense.expires_at ? new Date(existingLicense.expires_at * 1e3).toISOString() : "never",
        message: "This machine is already registered"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const features2 = JSON.parse(enrollment.features || '["scan", "cve_check", "dashboard_view"]');
    const trialDays = 30;
    const expiresAt = now + trialDays * 86400;
    const { apiKey } = await generateAPIKey();
    await env2.DB.prepare(`
			INSERT INTO licenses (
				machine_id, organization, features, license_tier,
				issued_at, expires_at, max_devices, revoked, validation_count,
				enrollment_token_id, hostname, platform, agent_version,
				max_concurrent_scans, retention_days, ai_credits_monthly, api_key
			) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(machine_id) DO UPDATE SET
				organization = excluded.organization,
				features = excluded.features,
				license_tier = excluded.license_tier,
				expires_at = excluded.expires_at,
				revoked = 0,
				enrollment_token_id = excluded.enrollment_token_id,
				hostname = excluded.hostname,
				platform = excluded.platform,
				agent_version = excluded.agent_version,
				api_key = excluded.api_key
		`).bind(
      machine_id,
      enrollment.organization,
      JSON.stringify(features2),
      enrollment.license_tier || "trial",
      now,
      expiresAt,
      enrollment.id,
      hostname || "unknown",
      platform2 || "unknown",
      agent_version || "unknown",
      getTierLimit(enrollment.license_tier, "max_devices"),
      getTierLimit(enrollment.license_tier, "max_concurrent_scans"),
      getTierLimit(enrollment.license_tier, "retention_days"),
      apiKey
    ).run();
    await incrementEnrollmentUsage(env2, enrollment.id);
    await env2.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'auto_register', ?, ?, ?)
		`).bind(
      machine_id,
      now,
      JSON.stringify({ enrollment_token_id: enrollment.id, hostname, platform: platform2, agent_version }),
      "system:auto-registration"
    ).run();
    return new Response(JSON.stringify({
      status: "registered",
      machine_id,
      organization: enrollment.organization,
      features: features2,
      license_tier: enrollment.license_tier || "trial",
      issued_at: new Date(now * 1e3).toISOString(),
      expires_at: new Date(expiresAt * 1e3).toISOString(),
      days_remaining: trialDays,
      api_key: apiKey,
      validation_url: "https://telemetry.souhimbou.org/license/validate",
      heartbeat_url: "https://telemetry.souhimbou.org/license/heartbeat",
      client_country: request.cf?.country || "UNKNOWN",
      message: "License activated successfully! Run scans to begin protecting your infrastructure."
    }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("License registration error:", error);
    return new Response(JSON.stringify({
      error: "Registration failed",
      message: error.message
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}
__name(handleLicenseRegister, "handleLicenseRegister");
async function handleEnrollmentTokenCreate(request, env2, corsHeaders, admin) {
  try {
    const {
      organization,
      license_tier,
      features: features2,
      max_registrations,
      expires_in_days
    } = await request.json();
    if (!organization) {
      return new Response(JSON.stringify({
        error: "Missing required field: organization"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const now = Math.floor(Date.now() / 1e3);
    const expiresAt = expires_in_days ? now + expires_in_days * 86400 : null;
    const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const orgSlug = organization.toLowerCase().replaceAll(/[^a-z0-9]/g, "").slice(0, 12);
    const token = `khepra-enroll-${orgSlug}-${randomPart}`;
    await env2.DB.prepare(`
			INSERT INTO enrollment_tokens (
				token, organization, license_tier, features,
				max_registrations, current_registrations,
				created_at, expires_at, active, created_by
			) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1, ?)
		`).bind(
      token,
      organization,
      license_tier || "trial",
      JSON.stringify(features2 || ["scan", "cve_check", "dashboard_view"]),
      max_registrations || 5,
      now,
      expiresAt,
      admin?.username || "system"
    ).run();
    return new Response(JSON.stringify({
      status: "created",
      enrollment_token: token,
      organization,
      license_tier: license_tier || "trial",
      features: features2 || ["scan", "cve_check", "dashboard_view"],
      max_registrations: max_registrations || 5,
      expires_at: expiresAt ? new Date(expiresAt * 1e3).toISOString() : "never",
      usage: {
        agent_flag: `--enrollment-token=${token}`,
        env_var: `KHEPRA_ENROLLMENT_TOKEN=${token}`,
        api_call: 'POST /license/register { "machine_id": "...", "enrollment_token": "' + token + '" }'
      }
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Enrollment token creation error:", error);
    return new Response(JSON.stringify({
      error: "Failed to create enrollment token",
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleEnrollmentTokenCreate, "handleEnrollmentTokenCreate");
async function handleEnrollmentTokenList(request, env2, corsHeaders, admin) {
  try {
    const tokens = await env2.DB.prepare(`
			SELECT
				id, token, organization, license_tier, features,
				max_registrations, current_registrations,
				created_at, expires_at, active, last_used, created_by
			FROM enrollment_tokens
			ORDER BY created_at DESC
			LIMIT 100
		`).all();
    return new Response(JSON.stringify({
      tokens: tokens.results.map((t) => ({
        ...t,
        features: JSON.parse(t.features || "[]"),
        created_at: new Date(t.created_at * 1e3).toISOString(),
        expires_at: t.expires_at ? new Date(t.expires_at * 1e3).toISOString() : null,
        last_used: t.last_used ? new Date(t.last_used * 1e3).toISOString() : null
      })),
      total: tokens.results.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Enrollment token list error:", error);
    return new Response(JSON.stringify({
      error: "Failed to list enrollment tokens"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleEnrollmentTokenList, "handleEnrollmentTokenList");
async function handleStripeWebhook(request, env2, corsHeaders) {
  try {
    const signature = request.headers.get("stripe-signature");
    const rawBody = await request.text();
    if (!signature || !env2.STRIPE_WEBHOOK_SECRET) {
      console.error("Missing Stripe signature or webhook secret");
      return new Response(JSON.stringify({
        error: "Missing webhook signature"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const signatureParts = signature.split(",").reduce((acc, part) => {
      const [key2, value] = part.split("=");
      acc[key2] = value;
      return acc;
    }, {});
    const timestamp = signatureParts["t"];
    const expectedSig = signatureParts["v1"];
    const now = Math.floor(Date.now() / 1e3);
    if (Math.abs(now - Number.parseInt(timestamp)) > 300) {
      return new Response(JSON.stringify({
        error: "Webhook timestamp expired"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const signedPayload = `${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env2.STRIPE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const expectedSigBytes = new Uint8Array(
      expectedSig.match(/.{2}/g).map((b) => Number.parseInt(b, 16))
    );
    const sigValid = await crypto.subtle.verify(
      "HMAC",
      key,
      expectedSigBytes,
      encoder.encode(signedPayload)
    );
    if (!sigValid) {
      console.error("Invalid Stripe webhook signature");
      return new Response(JSON.stringify({
        error: "Invalid signature"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const event = JSON.parse(rawBody);
    console.log(`Stripe webhook: ${event.type}`);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerEmail = session.customer_email || session.customer_details?.email;
      const customerId = session.customer;
      const metadata = session.metadata || {};
      const licenseTier = metadata.license_tier || "enterprise";
      const organization = metadata.organization || customerEmail?.split("@")[1] || "Unknown";
      const machineId = metadata.machine_id || `stripe-${session.id}`;
      const tierConfig = getLicenseTierConfig(licenseTier);
      const requestId = `req-${crypto.randomUUID().slice(0, 8)}`;
      const requestedAt = Math.floor(Date.now() / 1e3);
      await env2.DB.prepare(`
				INSERT INTO license_requests (
					request_id, machine_id, organization, customer_email,
					stripe_session_id, stripe_customer_id,
					license_tier, features, limits,
					requested_at, status, source
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'stripe')
			`).bind(
        requestId,
        machineId,
        organization,
        customerEmail,
        session.id,
        customerId,
        licenseTier,
        JSON.stringify(tierConfig.features),
        JSON.stringify(tierConfig.limits),
        requestedAt
      ).run();
      await env2.DB.prepare(`
				INSERT INTO license_audit_log (
					machine_id, action, timestamp, details, admin_user
				) VALUES (?, 'stripe_payment', ?, ?, ?)
			`).bind(
        machineId,
        requestedAt,
        JSON.stringify({
          request_id: requestId,
          stripe_session_id: session.id,
          amount: session.amount_total,
          currency: session.currency,
          customer_email: customerEmail
        }),
        "system:stripe-webhook"
      ).run();
      return new Response(JSON.stringify({
        received: true,
        request_id: requestId,
        message: "License request queued for signing"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      console.log(`Subscription event: ${event.type}`, subscription.id);
    }
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      await env2.DB.prepare(`
				UPDATE licenses
				SET revoked = 1, revoked_at = ?, revoked_reason = 'Subscription cancelled'
				WHERE stripe_customer_id = ? AND revoked = 0
			`).bind(Math.floor(Date.now() / 1e3), customerId).run();
      console.log(`Subscription cancelled for customer: ${customerId}`);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return new Response(JSON.stringify({
      error: "Webhook processing failed",
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleStripeWebhook, "handleStripeWebhook");
async function handlePilotSignup(request, env2, corsHeaders) {
  try {
    const {
      email,
      organization,
      name,
      use_case,
      machine_id,
      referral_source
    } = await request.json();
    if (!email || !organization) {
      return new Response(JSON.stringify({
        error: "Missing required fields: email, organization"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return new Response(JSON.stringify({
        error: "Invalid email format"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const now = Math.floor(Date.now() / 1e3);
    const existingPilot = await env2.DB.prepare(`
			SELECT id, status FROM pilot_signups
			WHERE email = ? AND status IN ('active', 'pending')
		`).bind(email).first();
    if (existingPilot) {
      return new Response(JSON.stringify({
        error: "Pilot already exists",
        status: existingPilot.status,
        message: "A pilot license is already associated with this email"
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const randomPart = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    const orgSlug = organization.toLowerCase().replaceAll(/[^a-z0-9]/g, "").slice(0, 12);
    const enrollmentToken = `khepra-pilot-${orgSlug}-${randomPart}`;
    const trialDays = 30;
    const expiresAt = now + trialDays * 86400;
    const pilotFeatures = ["scan", "cve_check", "dashboard_view", "risk_scoring", "pilot_support"];
    const pilotId = `pilot-${crypto.randomUUID().slice(0, 8)}`;
    await env2.DB.prepare(`
			INSERT INTO pilot_signups (
				pilot_id, email, organization, contact_name,
				use_case, referral_source, enrollment_token,
				created_at, expires_at, status
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
		`).bind(
      pilotId,
      email,
      organization,
      name || "",
      use_case || "",
      referral_source || "direct",
      enrollmentToken,
      now,
      expiresAt
    ).run();
    await env2.DB.prepare(`
			INSERT INTO enrollment_tokens (
				token, organization, license_tier, features,
				max_registrations, current_registrations,
				created_at, expires_at, active, created_by
			) VALUES (?, ?, 'pilot', ?, 5, 0, ?, ?, 1, ?)
		`).bind(
      enrollmentToken,
      organization,
      JSON.stringify(pilotFeatures),
      now,
      expiresAt,
      "system:pilot-signup"
    ).run();
    let licenseRequestId = null;
    if (machine_id) {
      licenseRequestId = `req-${crypto.randomUUID().slice(0, 8)}`;
      const tierConfig = getLicenseTierConfig("pilot");
      await env2.DB.prepare(`
				INSERT INTO license_requests (
					request_id, machine_id, organization, customer_email,
					license_tier, features, limits,
					requested_at, status, source, pilot_id
				) VALUES (?, ?, ?, ?, 'pilot', ?, ?, ?, 'pending', 'pilot_signup', ?)
			`).bind(
        licenseRequestId,
        machine_id,
        organization,
        email,
        JSON.stringify(tierConfig.features),
        JSON.stringify(tierConfig.limits),
        now,
        pilotId
      ).run();
    }
    await env2.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'pilot_signup', ?, ?, ?)
		`).bind(
      machine_id || pilotId,
      now,
      JSON.stringify({
        pilot_id: pilotId,
        email,
        organization,
        enrollment_token: enrollmentToken,
        license_request_id: licenseRequestId
      }),
      "system:pilot-signup"
    ).run();
    const country = request.cf?.country || "UNKNOWN";
    return new Response(JSON.stringify({
      status: "pilot_created",
      pilot_id: pilotId,
      enrollment_token: enrollmentToken,
      organization,
      trial_days: trialDays,
      expires_at: new Date(expiresAt * 1e3).toISOString(),
      features: pilotFeatures,
      license_request_id: licenseRequestId,
      next_steps: {
        install: "Download KHEPRA agent from https://souhimbou.org/download",
        register: `Use enrollment token: ${enrollmentToken}`,
        api_call: `POST /license/register { "machine_id": "...", "enrollment_token": "${enrollmentToken}" }`
      },
      client_country: country,
      message: "Welcome to the KHEPRA pilot program! Your 30-day trial starts now."
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Pilot signup error:", error);
    return new Response(JSON.stringify({
      error: "Pilot signup failed",
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handlePilotSignup, "handlePilotSignup");
async function handleLicensesPending(request, env2, corsHeaders, admin) {
  try {
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get("limit") || "10");
    const source = url.searchParams.get("source");
    const query = source ? `SELECT request_id, machine_id, organization, customer_email,
				stripe_session_id, stripe_customer_id, pilot_id,
				license_tier, features, limits, requested_at, source
			FROM license_requests
			WHERE status = 'pending' AND source = ?
			ORDER BY requested_at ASC LIMIT ?` : `SELECT request_id, machine_id, organization, customer_email,
				stripe_session_id, stripe_customer_id, pilot_id,
				license_tier, features, limits, requested_at, source
			FROM license_requests
			WHERE status = 'pending'
			ORDER BY requested_at ASC LIMIT ?`;
    const pending = source ? await env2.DB.prepare(query).bind(source, limit).all() : await env2.DB.prepare(query).bind(limit).all();
    return new Response(JSON.stringify({
      pending: pending.results.map((req) => ({
        ...req,
        features: JSON.parse(req.features || "[]"),
        limits: JSON.parse(req.limits || "{}"),
        requested_at: new Date(req.requested_at * 1e3).toISOString()
      })),
      count: pending.results.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get pending licenses error:", error);
    return new Response(JSON.stringify({
      error: "Failed to fetch pending licenses"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleLicensesPending, "handleLicensesPending");
async function handleLicenseComplete(request, env2, corsHeaders, admin) {
  try {
    const {
      request_id,
      machine_id,
      signature,
      // ML-DSA-65 signature (hex)
      license_blob,
      // Full signed license blob
      expires_in_days
      // Override expiration if needed
    } = await request.json();
    if (!request_id || !machine_id || !signature) {
      return new Response(JSON.stringify({
        error: "Missing required fields: request_id, machine_id, signature"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const pendingReq = await env2.DB.prepare(`
			SELECT * FROM license_requests
			WHERE request_id = ? AND status = 'pending'
		`).bind(request_id).first();
    if (!pendingReq) {
      return new Response(JSON.stringify({
        error: "License request not found or already processed"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const now = Math.floor(Date.now() / 1e3);
    const features2 = JSON.parse(pendingReq.features || "[]");
    const limits = JSON.parse(pendingReq.limits || "{}");
    let expiresAt = null;
    if (expires_in_days) {
      expiresAt = now + expires_in_days * 86400;
    } else if (pendingReq.license_tier === "pilot") {
      expiresAt = now + 30 * 86400;
    } else if (pendingReq.license_tier === "enterprise") {
      expiresAt = now + 365 * 86400;
    }
    await env2.DB.prepare(`
			INSERT INTO licenses (
				machine_id, organization, features, license_tier,
				issued_at, expires_at, max_devices, revoked, validation_count,
				max_concurrent_scans, retention_days, ai_credits_monthly,
				stripe_customer_id, pilot_id, signature, license_blob
			) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(machine_id) DO UPDATE SET
				organization = excluded.organization,
				features = excluded.features,
				license_tier = excluded.license_tier,
				expires_at = excluded.expires_at,
				revoked = 0,
				signature = excluded.signature,
				license_blob = excluded.license_blob
		`).bind(
      machine_id,
      pendingReq.organization,
      JSON.stringify(features2),
      pendingReq.license_tier,
      now,
      expiresAt,
      limits.max_devices || 1,
      limits.max_concurrent_scans || 5,
      limits.retention_days || 1,
      limits.ai_credits_monthly || 50,
      pendingReq.stripe_customer_id,
      pendingReq.pilot_id,
      signature,
      license_blob
    ).run();
    await env2.DB.prepare(`
			UPDATE license_requests
			SET status = 'completed', completed_at = ?, signature = ?
			WHERE request_id = ?
		`).bind(now, signature, request_id).run();
    if (pendingReq.pilot_id) {
      await env2.DB.prepare(`
				UPDATE pilot_signups
				SET status = 'active', activated_at = ?
				WHERE pilot_id = ?
			`).bind(now, pendingReq.pilot_id).run();
    }
    await env2.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'license_signed', ?, ?, ?)
		`).bind(
      machine_id,
      now,
      JSON.stringify({
        request_id,
        license_tier: pendingReq.license_tier,
        source: pendingReq.source,
        expires_at: expiresAt
      }),
      admin?.username || "local-signer"
    ).run();
    return new Response(JSON.stringify({
      status: "completed",
      machine_id,
      organization: pendingReq.organization,
      license_tier: pendingReq.license_tier,
      features: features2,
      issued_at: new Date(now * 1e3).toISOString(),
      expires_at: expiresAt ? new Date(expiresAt * 1e3).toISOString() : "never",
      validation_url: "https://telemetry.souhimbou.org/license/validate"
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("License completion error:", error);
    return new Response(JSON.stringify({
      error: "License completion failed",
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleLicenseComplete, "handleLicenseComplete");
function getLicenseTierConfig(tier) {
  const configs = {
    pilot: {
      features: ["scan", "cve_check", "dashboard_view", "risk_scoring", "pilot_support"],
      limits: {
        max_devices: 5,
        max_concurrent_scans: 5,
        retention_days: 7,
        ai_credits_monthly: 100
      }
    },
    pro: {
      features: ["scan", "cve_check", "dashboard_view", "risk_scoring", "api_access", "priority_support"],
      limits: {
        max_devices: 25,
        max_concurrent_scans: 20,
        retention_days: 30,
        ai_credits_monthly: 500
      }
    },
    enterprise: {
      features: [
        "scan",
        "cve_check",
        "dashboard_view",
        "risk_scoring",
        "api_access",
        "premium_pqc",
        "white_box_crypto",
        "stig_automation",
        "sso_integration",
        "enterprise_support",
        "custom_compliance"
      ],
      limits: {
        max_devices: 500,
        max_concurrent_scans: 100,
        retention_days: 365,
        ai_credits_monthly: 5e3
      }
    },
    government: {
      features: [
        "scan",
        "cve_check",
        "dashboard_view",
        "risk_scoring",
        "api_access",
        "premium_pqc",
        "white_box_crypto",
        "stig_automation",
        "sso_integration",
        "fedramp_compliance",
        "il4_il5_support",
        "air_gap_mode",
        "dod_premium"
      ],
      limits: {
        max_devices: -1,
        // Unlimited
        max_concurrent_scans: -1,
        retention_days: 2555,
        // 7 years (DoD retention requirement)
        ai_credits_monthly: -1
      }
    }
  };
  return configs[tier] || configs.pilot;
}
__name(getLicenseTierConfig, "getLicenseTierConfig");
async function handleLicenseIssue(request, env2, corsHeaders, admin) {
  try {
    const {
      machine_id,
      organization,
      features: features2,
      license_tier,
      expires_in_days,
      max_devices,
      max_concurrent_scans,
      retention_days,
      ai_credits_monthly
    } = await request.json();
    if (!machine_id || !organization) {
      return new Response(JSON.stringify({
        error: "Missing required fields: machine_id, organization"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const now = Math.floor(Date.now() / 1e3);
    const expiresAt = expires_in_days ? now + expires_in_days * 86400 : null;
    await env2.DB.prepare(`
			INSERT INTO licenses (
				machine_id, organization, features, license_tier,
				issued_at, expires_at, max_devices, revoked, validation_count,
				max_concurrent_scans, retention_days, ai_credits_monthly
			) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
			ON CONFLICT(machine_id) DO UPDATE SET
				organization = excluded.organization,
				features = excluded.features,
				license_tier = excluded.license_tier,
				expires_at = excluded.expires_at,
				max_devices = excluded.max_devices,
				revoked = 0
		`).bind(
      machine_id,
      organization,
      JSON.stringify(features2 || ["premium_pqc", "white_box_crypto"]),
      license_tier || "dod_premium",
      now,
      expiresAt,
      max_devices || 1,
      max_concurrent_scans || 5,
      retention_days || 1,
      ai_credits_monthly || 50
    ).run();
    await env2.DB.prepare(`
			INSERT INTO license_audit_log (
				machine_id, action, timestamp, details, admin_user
			) VALUES (?, 'issue', ?, ?, ?)
		`).bind(
      machine_id,
      now,
      JSON.stringify({ organization, license_tier, expires_in_days }),
      admin?.username || "unknown"
    ).run();
    return new Response(JSON.stringify({
      status: "issued",
      machine_id,
      organization,
      features: features2 || ["premium_pqc", "white_box_crypto"],
      issued_at: new Date(now * 1e3).toISOString(),
      expires_at: expiresAt ? new Date(expiresAt * 1e3).toISOString() : "never",
      validation_url: "https://telemetry.souhimbou.org/license/validate"
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("License issuance error:", error);
    return new Response(JSON.stringify({
      error: "Failed to issue license",
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleLicenseIssue, "handleLicenseIssue");
function getTierLimit(tier, limitType) {
  const limits = {
    business: { max_devices: 50, max_concurrent_scans: 30, retention_days: 500 },
    pro: { max_devices: 20, max_concurrent_scans: 7, retention_days: 150 },
    default: { max_devices: 5, max_concurrent_scans: 1, retention_days: 50 }
  };
  const selected = limits[tier] || limits.default;
  return selected[limitType];
}
__name(getTierLimit, "getTierLimit");
async function getLicenseFromDB(env2, machine_id) {
  return await env2.DB.prepare(`
		SELECT
			machine_id,
			organization,
			features,
			issued_at,
			expires_at,
			revoked,
			license_tier,
			max_devices,
			max_concurrent_scans,
			retention_days,
			ai_credits_monthly
		FROM licenses
		WHERE machine_id = ? AND revoked = 0
	`).bind(machine_id).first();
}
__name(getLicenseFromDB, "getLicenseFromDB");
async function logValidationResult(env2, machine_id, result, details = {}) {
  try {
    const now = Math.floor(Date.now() / 1e3);
    if (result === "success") {
      await env2.DB.prepare(`
				INSERT INTO license_validations (
					machine_id, timestamp, version, installation_id, validation_result
				) VALUES (?, ?, ?, ?, 'success')
			`).bind(
        machine_id,
        now,
        details.version || "unknown",
        details.installation_id || machine_id
      ).run();
      await env2.DB.prepare(`
				UPDATE licenses
				SET last_validated = ?, validation_count = validation_count + 1
				WHERE machine_id = ?
			`).bind(now, machine_id).run();
    } else {
      await env2.DB.prepare(`
				INSERT INTO license_validations (
					machine_id, timestamp, version, validation_result, error_message
				) VALUES (?, ?, ?, 'error', ?)
			`).bind(
        machine_id || "error-unknown",
        now,
        details.version || "unknown",
        details.error_message || "Unknown error"
      ).run();
    }
  } catch (logError) {
    console.error("Failed to log validation result:", logError);
  }
}
__name(logValidationResult, "logValidationResult");
async function verifySignature(env2, machine_id, signature) {
  if (!signature || !env2.TELEMETRY_PUBLIC_KEY) return false;
  try {
    const { ml_dsa65: ml_dsa652 } = await Promise.resolve().then(() => (init_ml_dsa(), ml_dsa_exports));
    if (env2.TELEMETRY_PUBLIC_KEY.length === 2624) {
      const pubKeyBytes = new Uint8Array(env2.TELEMETRY_PUBLIC_KEY.match(/.{1,2}/g).map((byte) => Number.parseInt(byte, 16)));
      const sigBytes = new Uint8Array(signature.match(/.{1,2}/g).map((byte) => Number.parseInt(byte, 16)));
      const msgBytes = new TextEncoder().encode(machine_id);
      return ml_dsa652.verify(sigBytes, msgBytes, pubKeyBytes);
    }
  } catch (e) {
    console.error("Signature verification error:", e);
  }
  return false;
}
__name(verifySignature, "verifySignature");
async function getEnrollmentToken(env2, token) {
  return await env2.DB.prepare(`
		SELECT
			id, organization, license_tier, features,
			max_registrations, current_registrations,
			expires_at, active
		FROM enrollment_tokens
		WHERE token = ? AND active = 1
	`).bind(token).first();
}
__name(getEnrollmentToken, "getEnrollmentToken");
async function checkExistingLicense(env2, machine_id) {
  return await env2.DB.prepare(`
		SELECT machine_id, revoked, features, license_tier, expires_at, issued_at
		FROM licenses WHERE machine_id = ?
	`).bind(machine_id).first();
}
__name(checkExistingLicense, "checkExistingLicense");
async function incrementEnrollmentUsage(env2, enrollment_id) {
  const now = Math.floor(Date.now() / 1e3);
  await env2.DB.prepare(`
		UPDATE enrollment_tokens
		SET current_registrations = current_registrations + 1,
			last_used = ?
		WHERE id = ?
	`).bind(now, enrollment_id).run();
}
__name(incrementEnrollmentUsage, "incrementEnrollmentUsage");

// src/admin-auth.js
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();
var import_bcryptjs = __toESM(require_bcrypt());
async function handleAdminLogin(request, env2, corsHeaders) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error("JSON parse error:", jsonError.message);
      return new Response(JSON.stringify({
        error: "Invalid JSON in request body"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { username, password } = body;
    if (!username || !password) {
      return new Response(JSON.stringify({
        error: "Missing username or password"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const admin = await env2.DB.prepare(`
			SELECT id, username, password_hash, role, active
			FROM admin_users
			WHERE username = ?
		`).bind(username).first();
    if (!admin) {
      await import_bcryptjs.default.hash(password, 10);
      return new Response(JSON.stringify({
        error: "Invalid credentials"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (admin.active !== 1) {
      return new Response(JSON.stringify({
        error: "Account disabled"
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const passwordValid = await import_bcryptjs.default.compare(password, admin.password_hash);
    if (!passwordValid) {
      return new Response(JSON.stringify({
        error: "Invalid credentials"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const now = Math.floor(Date.now() / 1e3);
    const expiresAt = now + 24 * 3600;
    const jti = crypto.randomUUID();
    const jwtPayload = {
      jti,
      sub: admin.username,
      admin_id: admin.id,
      role: admin.role,
      iat: now,
      exp: expiresAt,
      iss: "telemetry.souhimbou.org"
    };
    const token = await signJWT(jwtPayload, env2.JWT_SECRET);
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const userAgent = request.headers.get("User-Agent") || "unknown";
    await env2.DB.prepare(`
			INSERT INTO admin_sessions (
				admin_id, token_jti, issued_at, expires_at, ip_address, user_agent
			) VALUES (?, ?, ?, ?, ?, ?)
		`).bind(
      admin.id,
      jti,
      now,
      expiresAt,
      clientIP,
      userAgent
    ).run();
    await env2.DB.prepare(`
			UPDATE admin_users SET last_login = ? WHERE id = ?
		`).bind(now, admin.id).run();
    const isDefaultPassword = await import_bcryptjs.default.compare("Change1234!", admin.password_hash);
    const warning = isDefaultPassword ? "WARNING: You are using the default password. Change it immediately!" : null;
    return new Response(JSON.stringify({
      token,
      expires_at: new Date(expiresAt * 1e3).toISOString(),
      admin: {
        username: admin.username,
        role: admin.role
      },
      warning
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return new Response(JSON.stringify({
      error: "Login failed"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleAdminLogin, "handleAdminLogin");
async function verifyAdminAuth(request, env2) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  if (env2.ADMIN_API_KEY && token === env2.ADMIN_API_KEY) {
    return {
      admin_id: 0,
      username: "api-key-emergency",
      role: "super_admin"
    };
  }
  try {
    const payload = await verifyJWT(token, env2.JWT_SECRET);
    const session = await env2.DB.prepare(`
			SELECT revoked FROM admin_sessions WHERE token_jti = ?
		`).bind(payload.jti).first();
    if (session && session.revoked === 1) {
      return null;
    }
    return {
      admin_id: payload.admin_id,
      username: payload.sub,
      role: payload.role,
      jti: payload.jti
    };
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}
__name(verifyAdminAuth, "verifyAdminAuth");
async function handleAdminLogout(request, env2, corsHeaders) {
  try {
    const admin = await verifyAdminAuth(request, env2);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (admin.jti) {
      await env2.DB.prepare(`
				UPDATE admin_sessions
				SET revoked = 1, revoked_at = ?
				WHERE token_jti = ?
			`).bind(Math.floor(Date.now() / 1e3), admin.jti).run();
    }
    return new Response(JSON.stringify({
      message: "Logged out successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Logout error:", error);
    return new Response(JSON.stringify({
      error: "Logout failed"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleAdminLogout, "handleAdminLogout");
async function handleChangePassword(request, env2, corsHeaders) {
  try {
    const admin = await verifyAdminAuth(request, env2);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { old_password, new_password } = await request.json();
    if (!old_password || !new_password) {
      return new Response(JSON.stringify({
        error: "Missing old_password or new_password"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (new_password.length < 12) {
      return new Response(JSON.stringify({
        error: "Password must be at least 12 characters"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const user = await env2.DB.prepare(`
			SELECT password_hash FROM admin_users WHERE id = ?
		`).bind(admin.admin_id).first();
    const oldPasswordValid = await import_bcryptjs.default.compare(old_password, user.password_hash);
    if (!oldPasswordValid) {
      return new Response(JSON.stringify({
        error: "Invalid old password"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const newPasswordHash = await import_bcryptjs.default.hash(new_password, 10);
    await env2.DB.prepare(`
			UPDATE admin_users SET password_hash = ? WHERE id = ?
		`).bind(newPasswordHash, admin.admin_id).run();
    await env2.DB.prepare(`
			UPDATE admin_sessions
			SET revoked = 1, revoked_at = ?
			WHERE admin_id = ? AND revoked = 0
		`).bind(Math.floor(Date.now() / 1e3), admin.admin_id).run();
    return new Response(JSON.stringify({
      message: "Password changed successfully. Please log in again."
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Change password error:", error);
    return new Response(JSON.stringify({
      error: "Password change failed"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleChangePassword, "handleChangePassword");
async function signJWT(payload, secret) {
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  const encodedSignature = base64urlEncode(signature);
  return `${data}.${encodedSignature}`;
}
__name(signJWT, "signJWT");
async function verifyJWT(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signature = base64urlDecode(encodedSignature);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(data)
  );
  if (!valid) {
    throw new Error("Invalid JWT signature");
  }
  const payload = JSON.parse(base64urlDecodeString(encodedPayload));
  const now = Math.floor(Date.now() / 1e3);
  if (payload.exp && payload.exp < now) {
    throw new Error("JWT expired");
  }
  return payload;
}
__name(verifyJWT, "verifyJWT");
function base64urlEncode(data) {
  let bytes;
  if (typeof data === "string") {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
__name(base64urlEncode, "base64urlEncode");
function base64urlDecode(str) {
  str = str.replaceAll("-", "+").replaceAll("_", "/");
  const pad = str.length % 4;
  if (pad) {
    str += "=".repeat(4 - pad);
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.codePointAt(i);
  }
  return bytes.buffer;
}
__name(base64urlDecode, "base64urlDecode");
function base64urlDecodeString(str) {
  const buffer = base64urlDecode(str);
  return new TextDecoder().decode(buffer);
}
__name(base64urlDecodeString, "base64urlDecodeString");

// src/forwarding.js
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_performance2();
async function generateServiceToken(serviceName, secret) {
  const timestamp = Math.floor(Date.now() / 1e3);
  const timestampHex = timestamp.toString(16).padStart(16, "0");
  const message = `khepra-svc-${serviceName}-${timestampHex}`;
  const secretBytes = hexToBytes(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const signatureHex = bytesToHex(new Uint8Array(signature));
  return `${message}-${signatureHex}`;
}
__name(generateServiceToken, "generateServiceToken");
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
__name(hexToBytes, "hexToBytes");
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(bytesToHex, "bytesToHex");
async function forwardToDemarc(env2, aggregatedData) {
  const demarcUrl = env2.DEMARC_GATEWAY_URL || "https://gateway.souhimbou.org";
  const serviceSecret = env2.KHEPRA_SERVICE_SECRET;
  if (!serviceSecret) {
    console.error("KHEPRA_SERVICE_SECRET not configured");
    return { success: false, error: "Missing service secret" };
  }
  try {
    const serviceToken = await generateServiceToken("cloudflare-telemetry", serviceSecret);
    const response = await fetch(`${demarcUrl}/api/v1/telemetry/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceToken}`,
        "X-Service-Name": "cloudflare-telemetry",
        "X-Request-ID": crypto.randomUUID()
      },
      body: JSON.stringify(aggregatedData)
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("DEMARC forward failed:", response.status, error);
      return { success: false, error: `HTTP ${response.status}` };
    }
    return { success: true };
  } catch (error) {
    console.error("DEMARC forward error:", error);
    return { success: false, error: error.message };
  }
}
__name(forwardToDemarc, "forwardToDemarc");
async function forwardToSupabase(env2, data) {
  const supabaseUrl = env2.SUPABASE_URL;
  const supabaseKey = env2.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not configured");
    return { success: false, error: "Missing Supabase config" };
  }
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${data.table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(data.records)
    });
    if (!response.ok) {
      const error = await response.text();
      console.error("Supabase insert failed:", response.status, error);
      return { success: false, error: `HTTP ${response.status}` };
    }
    return { success: true };
  } catch (error) {
    console.error("Supabase error:", error);
    return { success: false, error: error.message };
  }
}
__name(forwardToSupabase, "forwardToSupabase");
async function aggregateCryptoInventory(env2) {
  const now = Math.floor(Date.now() / 1e3);
  const oneDayAgo = now - 86400;
  try {
    const results = await env2.DB.prepare(`
			SELECT
				device_hash,
				country,
				MAX(rsa_2048_count) as rsa_2048_count,
				MAX(rsa_3072_count) as rsa_3072_count,
				MAX(rsa_4096_count) as rsa_4096_count,
				MAX(ecc_p256_count) as ecc_p256_count,
				MAX(ecc_p384_count) as ecc_p384_count,
				MAX(dilithium3_count) as dilithium3_count,
				MAX(kyber1024_count) as kyber1024_count,
				MAX(tls_config) as tls_config,
				MAX(timestamp) as last_scan_at
			FROM beacons
			WHERE timestamp > ?
			GROUP BY device_hash
		`).bind(oneDayAgo).all();
    if (results.results.length === 0) {
      console.log("No beacons to aggregate");
      return { success: true, count: 0 };
    }
    const aggregated = results.results.map((row) => {
      const classicalCount = (row.rsa_2048_count || 0) + (row.rsa_3072_count || 0) + (row.rsa_4096_count || 0) + (row.ecc_p256_count || 0) + (row.ecc_p384_count || 0);
      const pqcCount = (row.dilithium3_count || 0) + (row.kyber1024_count || 0);
      const totalKeys = classicalCount + pqcCount;
      const pqcReadinessScore = totalKeys > 0 ? pqcCount / totalKeys * 100 : 0;
      const quantumExposureScore = 100 - pqcReadinessScore;
      return {
        device_hash: row.device_hash,
        country: row.country,
        rsa_2048_count: row.rsa_2048_count || 0,
        rsa_3072_count: row.rsa_3072_count || 0,
        rsa_4096_count: row.rsa_4096_count || 0,
        ecc_p256_count: row.ecc_p256_count || 0,
        ecc_p384_count: row.ecc_p384_count || 0,
        dilithium3_count: row.dilithium3_count || 0,
        kyber1024_count: row.kyber1024_count || 0,
        tls_config: row.tls_config ? JSON.parse(row.tls_config) : {},
        pqc_readiness_score: Math.round(pqcReadinessScore * 100) / 100,
        quantum_exposure_score: Math.round(quantumExposureScore * 100) / 100,
        last_scan_at: new Date(row.last_scan_at * 1e3).toISOString()
      };
    });
    const forwardResult = await forwardToDemarc(env2, {
      type: "crypto_inventory",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "cloudflare-telemetry",
      records: aggregated
    });
    if (!forwardResult.success) {
      console.warn("DEMARC forward failed, trying direct Supabase");
      await forwardToSupabase(env2, {
        table: "crypto_inventory",
        records: aggregated
      });
    }
    await env2.DB.prepare(`
			INSERT INTO daily_stats (date, total_devices, avg_pqc_readiness, total_beacons)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(date) DO UPDATE SET
				total_devices = excluded.total_devices,
				avg_pqc_readiness = excluded.avg_pqc_readiness,
				total_beacons = excluded.total_beacons
		`).bind(
      (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      aggregated.length,
      aggregated.reduce((sum, r) => sum + r.pqc_readiness_score, 0) / aggregated.length,
      results.results.length
    ).run();
    console.log(`Aggregated ${aggregated.length} devices, forwarded to DEMARC`);
    return { success: true, count: aggregated.length };
  } catch (error) {
    console.error("Crypto inventory aggregation error:", error);
    return { success: false, error: error.message };
  }
}
__name(aggregateCryptoInventory, "aggregateCryptoInventory");
async function aggregateLicenseTelemetry(env2) {
  try {
    const licenses = await env2.DB.prepare(`
			SELECT
				l.machine_id,
				l.organization,
				l.license_tier,
				l.features,
				l.issued_at,
				l.expires_at,
				l.validation_count,
				l.last_validated,
				l.last_heartbeat,
				l.revoked,
				l.stripe_customer_id,
				l.pilot_id
			FROM licenses l
			WHERE l.revoked = 0
		`).all();
    if (licenses.results.length === 0) {
      return { success: true, count: 0 };
    }
    const now = Math.floor(Date.now() / 1e3);
    const telemetry = licenses.results.map((lic) => {
      let complianceStatus = "active";
      if (lic.revoked) {
        complianceStatus = "revoked";
      } else if (lic.expires_at && lic.expires_at < now) {
        complianceStatus = "violation";
      } else if (lic.last_heartbeat && now - lic.last_heartbeat > 7200) {
        complianceStatus = "warning";
      }
      return {
        machine_id: lic.machine_id,
        organization: lic.organization,
        license_tier: lic.license_tier,
        features: JSON.parse(lic.features || "[]"),
        issued_at: new Date(lic.issued_at * 1e3).toISOString(),
        expires_at: lic.expires_at ? new Date(lic.expires_at * 1e3).toISOString() : null,
        validation_count: lic.validation_count,
        last_heartbeat_at: lic.last_heartbeat ? new Date(lic.last_heartbeat * 1e3).toISOString() : null,
        last_validation_at: lic.last_validated ? new Date(lic.last_validated * 1e3).toISOString() : null,
        compliance_status: complianceStatus,
        stripe_customer_id: lic.stripe_customer_id,
        pilot_id: lic.pilot_id
      };
    });
    await forwardToDemarc(env2, {
      type: "license_telemetry",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      source: "cloudflare-telemetry",
      records: telemetry
    });
    console.log(`Forwarded ${telemetry.length} license records`);
    return { success: true, count: telemetry.length };
  } catch (error) {
    console.error("License telemetry aggregation error:", error);
    return { success: false, error: error.message };
  }
}
__name(aggregateLicenseTelemetry, "aggregateLicenseTelemetry");
async function forwardSecurityEvent(env2, event) {
  const securityEvent = {
    event_type: event.type,
    severity: event.severity || "warning",
    source_device_id: event.device_id,
    source_ip: event.ip,
    source_country: event.country,
    title: event.title,
    description: event.description,
    details: event.details || {},
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  return forwardToDemarc(env2, {
    type: "security_event",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    source: "cloudflare-telemetry",
    records: [securityEvent]
  });
}
__name(forwardSecurityEvent, "forwardSecurityEvent");
async function handleScheduled(event, env2, ctx) {
  console.log("Running scheduled aggregation:", event.cron);
  const [cryptoResult, licenseResult] = await Promise.all([
    aggregateCryptoInventory(env2),
    aggregateLicenseTelemetry(env2)
  ]);
  console.log("Aggregation complete:", {
    crypto: cryptoResult,
    license: licenseResult
  });
}
__name(handleScheduled, "handleScheduled");

// src/index.js
init_ml_dsa();
var index_default = {
  // Scheduled trigger for telemetry aggregation (hourly)
  async scheduled(event, env2, ctx) {
    return handleScheduled(event, env2, ctx);
  },
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Khepra-Signature, X-Khepra-Timestamp"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    if (url.pathname === "/beacon" && request.method === "POST") {
      return handleBeacon(request, env2, corsHeaders);
    }
    if (url.pathname === "/stats" && request.method === "GET") {
      return handleStats(request, env2, corsHeaders);
    }
    if (url.pathname === "/analytics" && request.method === "GET") {
      return handleAnalytics(request, env2, corsHeaders);
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return handleHealth(request, env2, corsHeaders);
    }
    if (url.pathname === "/admin/login" && request.method === "POST") {
      return handleAdminLogin(request, env2, corsHeaders);
    }
    if (url.pathname === "/admin/logout" && request.method === "POST") {
      return handleAdminLogout(request, env2, corsHeaders);
    }
    if (url.pathname === "/admin/change-password" && request.method === "POST") {
      return handleChangePassword(request, env2, corsHeaders);
    }
    if (url.pathname === "/license/validate" && request.method === "POST") {
      return handleLicenseValidate(request, env2, corsHeaders);
    }
    if (url.pathname === "/license/heartbeat" && request.method === "POST") {
      return handleLicenseHeartbeat(request, env2, corsHeaders);
    }
    if (url.pathname === "/license/register" && request.method === "POST") {
      return handleLicenseRegister(request, env2, corsHeaders);
    }
    if (url.pathname === "/license/issue" && request.method === "POST") {
      const admin = await verifyAdminAuth(request, env2);
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return handleLicenseIssue(request, env2, corsHeaders, admin);
    }
    const revokeMatch = url.pathname.match(/^\/license\/revoke\/([^\/]+)$/);
    if (revokeMatch && request.method === "DELETE") {
      const admin = await verifyAdminAuth(request, env2);
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const machineId = revokeMatch[1];
      return handleLicenseRevoke(request, env2, corsHeaders, machineId, admin);
    }
    if (url.pathname === "/enrollment/tokens" && request.method === "POST") {
      const admin = await verifyAdminAuth(request, env2);
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return handleEnrollmentTokenCreate(request, env2, corsHeaders, admin);
    }
    if (url.pathname === "/enrollment/tokens" && request.method === "GET") {
      const admin = await verifyAdminAuth(request, env2);
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return handleEnrollmentTokenList(request, env2, corsHeaders, admin);
    }
    if (url.pathname === "/api/webhooks/stripe" && request.method === "POST") {
      return handleStripeWebhook(request, env2, corsHeaders);
    }
    if (url.pathname === "/api/pilot/signup" && request.method === "POST") {
      return handlePilotSignup(request, env2, corsHeaders);
    }
    if (url.pathname === "/api/licenses/pending" && request.method === "GET") {
      const admin = await verifyAdminAuth(request, env2);
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return handleLicensesPending(request, env2, corsHeaders, admin);
    }
    if (url.pathname === "/api/licenses/complete" && request.method === "POST") {
      const admin = await verifyAdminAuth(request, env2);
      if (!admin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return handleLicenseComplete(request, env2, corsHeaders, admin);
    }
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders
    });
  }
};
async function handleBeacon(request, env2, corsHeaders) {
  try {
    const rawBody = await request.text();
    let beacon;
    try {
      beacon = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!beacon.telemetry_version || !beacon.timestamp || !beacon.anonymous_id) {
      return new Response(JSON.stringify({
        error: "Invalid beacon: missing required fields"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (rawBody.length > parseInt(env2.MAX_BEACON_SIZE || "10240")) {
      return new Response(JSON.stringify({ error: "Beacon too large" }), { status: 413, headers: corsHeaders });
    }
    const beaconId = beacon.beacon_id || `${beacon.anonymous_id}-${beacon.timestamp}`;
    const deviceHash = beacon.anonymous_id || "unknown";
    if (!await checkRateLimit(env2, deviceHash)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: corsHeaders });
    }
    let signatureValid = 0;
    const signatureHex = request.headers.get("X-Khepra-Signature");
    if (signatureHex && env2.TELEMETRY_PUBLIC_KEY) {
      try {
        if (env2.TELEMETRY_PUBLIC_KEY.length !== 2624) {
          console.error("Configuration Error: Invalid Public Key Length (Expected 2624 for ML-DSA-65)");
        } else {
          const pubKeyBytes = new Uint8Array(env2.TELEMETRY_PUBLIC_KEY.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
          const sigBytes = new Uint8Array(signatureHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
          const msgBytes = new TextEncoder().encode(rawBody);
          if (ml_dsa65.verify(sigBytes, msgBytes, pubKeyBytes)) {
            signatureValid = 1;
          } else {
            console.warn(`[Security] Invalid ML-DSA-65 signature for beacon: ${beaconId}`);
          }
        }
      } catch (e) {
        console.error("Signature verification exception:", e);
      }
    } else {
      console.warn(`[Security] Missing signature header for beacon: ${beaconId}`);
    }
    if (!beacon.signature) {
      console.warn("Beacon received without PQC signature:", beaconId);
    }
    const anomalies = await detectAnomalies(beacon, beaconId, signatureValid === 1);
    if (anomalies.length > 0) {
      await logAnomalies(env2, anomalies);
    }
    const country = request.cf?.country || "UNKNOWN";
    const cryptoInv = beacon.cryptographic_inventory || {};
    const scanMeta = beacon.scan_metadata || {};
    const result = await env2.DB.prepare(`
			INSERT INTO beacons (
				beacon_id, timestamp, scanner_version, os, arch,
				scan_duration_ms, total_assets_scanned,
				rsa_2048_keys, rsa_3072_keys, rsa_4096_keys,
				ecc_p256_keys, ecc_p384_keys,
				dilithium3_keys, kyber1024_keys,
				tls_weak_configs, deprecated_ciphers,
				signature_valid, device_id_hash, ip_country
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(beacon_id) DO NOTHING
		`).bind(
      beaconId,
      Math.floor(new Date(beacon.timestamp).getTime() / 1e3),
      scanMeta.scanner_version || beacon.scanner_version || "unknown",
      scanMeta.os || "unknown",
      scanMeta.arch || "unknown",
      scanMeta.scan_duration_ms || 0,
      scanMeta.total_assets_scanned || 0,
      cryptoInv.rsa_2048_keys || 0,
      cryptoInv.rsa_3072_keys || 0,
      cryptoInv.rsa_4096_keys || 0,
      cryptoInv.ecc_p256_keys || 0,
      cryptoInv.ecc_p384_keys || 0,
      cryptoInv.dilithium3_keys || 0,
      cryptoInv.kyber1024_keys || 0,
      cryptoInv.tls_weak_configs || 0,
      cryptoInv.deprecated_ciphers || 0,
      signatureValid,
      deviceHash,
      country
    ).run();
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    await env2.DB.prepare(`
			INSERT INTO daily_stats (
				date, total_scans, unique_devices, total_assets,
				total_rsa_2048_keys, total_rsa_3072_keys, total_rsa_4096_keys,
				total_ecc_p256_keys, total_ecc_p384_keys,
				total_dilithium3_keys, total_kyber1024_keys,
				total_tls_weak_configs, total_deprecated_ciphers,
				avg_scan_duration_ms
			) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(date) DO UPDATE SET
				total_scans = total_scans + 1,
				total_assets = total_assets + excluded.total_assets,
				total_rsa_2048_keys = total_rsa_2048_keys + excluded.total_rsa_2048_keys,
				total_rsa_3072_keys = total_rsa_3072_keys + excluded.total_rsa_3072_keys,
				total_rsa_4096_keys = total_rsa_4096_keys + excluded.total_rsa_4096_keys,
				total_ecc_p256_keys = total_ecc_p256_keys + excluded.total_ecc_p256_keys,
				total_ecc_p384_keys = total_ecc_p384_keys + excluded.total_ecc_p384_keys,
				total_dilithium3_keys = total_dilithium3_keys + excluded.total_dilithium3_keys,
				total_kyber1024_keys = total_kyber1024_keys + excluded.total_kyber1024_keys,
				total_tls_weak_configs = total_tls_weak_configs + excluded.total_tls_weak_configs,
				total_deprecated_ciphers = total_deprecated_ciphers + excluded.total_deprecated_ciphers,
				avg_scan_duration_ms = (avg_scan_duration_ms * total_scans + excluded.avg_scan_duration_ms) / (total_scans + 1),
				updated_at = strftime('%s', 'now')
		`).bind(
      today,
      scanMeta.total_assets_scanned || 0,
      cryptoInv.rsa_2048_keys || 0,
      cryptoInv.rsa_3072_keys || 0,
      cryptoInv.rsa_4096_keys || 0,
      cryptoInv.ecc_p256_keys || 0,
      cryptoInv.ecc_p384_keys || 0,
      cryptoInv.dilithium3_keys || 0,
      cryptoInv.kyber1024_keys || 0,
      cryptoInv.tls_weak_configs || 0,
      cryptoInv.deprecated_ciphers || 0,
      scanMeta.scan_duration_ms || 0
    ).run();
    const version2 = scanMeta.scanner_version || beacon.scanner_version || "unknown";
    await env2.DB.prepare(`
			INSERT INTO version_stats (scanner_version, usage_count)
			VALUES (?, 1)
			ON CONFLICT(scanner_version) DO UPDATE SET
				usage_count = usage_count + 1,
				last_seen = strftime('%s', 'now')
		`).bind(version2).run();
    await env2.DB.prepare(`
			INSERT INTO country_stats (
				ip_country, total_scans, unique_devices,
				total_rsa_2048_keys, total_ecc_p256_keys,
				total_dilithium3_keys, total_kyber1024_keys
			) VALUES (?, 1, 1, ?, ?, ?, ?)
			ON CONFLICT(ip_country) DO UPDATE SET
				total_scans = total_scans + 1,
				total_rsa_2048_keys = total_rsa_2048_keys + excluded.total_rsa_2048_keys,
				total_ecc_p256_keys = total_ecc_p256_keys + excluded.total_ecc_p256_keys,
				total_dilithium3_keys = total_dilithium3_keys + excluded.total_dilithium3_keys,
				total_kyber1024_keys = total_kyber1024_keys + excluded.total_kyber1024_keys,
				last_updated = strftime('%s', 'now')
		`).bind(
      country,
      cryptoInv.rsa_2048_keys || 0,
      cryptoInv.ecc_p256_keys || 0,
      cryptoInv.dilithium3_keys || 0,
      cryptoInv.kyber1024_keys || 0
    ).run();
    return new Response(JSON.stringify({
      status: "ok",
      beacon_id: beaconId,
      received_at: Date.now(),
      signature_verified: signatureValid === 1,
      anomalies_detected: anomalies.length
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Beacon processing error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleBeacon, "handleBeacon");
async function handleStats(request, env2, corsHeaders) {
  try {
    const overall = await env2.DB.prepare(`
			SELECT 
				COUNT(*) as total_scans,
				COUNT(DISTINCT device_id_hash) as unique_devices,
				SUM(total_assets_scanned) as total_assets,
				SUM(rsa_2048_keys) as quantum_vulnerable_rsa,
				SUM(ecc_p256_keys) as quantum_vulnerable_ecc,
				SUM(dilithium3_keys) as pqc_signing_keys,
				SUM(kyber1024_keys) as pqc_encryption_keys,
				AVG(scan_duration_ms) as avg_scan_duration_ms
			FROM beacons
			WHERE signature_valid = 1
		`).first();
    const daily = await env2.DB.prepare(`
			SELECT * FROM daily_stats 
			ORDER BY date DESC 
			LIMIT 30
		`).all();
    const versions2 = await env2.DB.prepare(`
			SELECT scanner_version, usage_count
			FROM version_stats
			ORDER BY usage_count DESC
			LIMIT 10
		`).all();
    return new Response(JSON.stringify({
      overall,
      daily: daily.results,
      versions: versions2.results,
      generated_at: Date.now()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Stats error:", error);
    return new Response(JSON.stringify({
      error: "Failed to retrieve stats"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleStats, "handleStats");
async function handleAnalytics(request, env2, corsHeaders) {
  try {
    const quantumExposure = await env2.DB.prepare(`
			SELECT * FROM v_quantum_exposure
		`).first();
    const pqcAdoption = await env2.DB.prepare(`
			SELECT * FROM v_pqc_adoption
			LIMIT 30
		`).all();
    const highRiskDevices = await env2.DB.prepare(`
			SELECT * FROM v_high_risk_devices
			LIMIT 20
		`).all();
    const geoDistribution = await env2.DB.prepare(`
			SELECT 
				ip_country,
				total_scans,
				unique_devices,
				total_rsa_2048_keys,
				total_ecc_p256_keys,
				total_dilithium3_keys,
				total_kyber1024_keys
			FROM country_stats
			ORDER BY total_rsa_2048_keys DESC
			LIMIT 50
		`).all();
    return new Response(JSON.stringify({
      quantum_exposure: quantumExposure,
      pqc_adoption_trend: pqcAdoption.results,
      high_risk_devices: highRiskDevices.results,
      geographic_distribution: geoDistribution.results,
      generated_at: Date.now()
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return new Response(JSON.stringify({
      error: "Failed to retrieve analytics"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleAnalytics, "handleAnalytics");
async function handleHealth(request, env2, corsHeaders) {
  try {
    await env2.DB.prepare("SELECT 1").first();
    return new Response(JSON.stringify({
      status: "ok",
      timestamp: Date.now(),
      service: "khepra-telemetry",
      database: "connected",
      version: "1.0.0"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: "degraded",
      error: "Database unavailable",
      timestamp: Date.now()
    }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
}
__name(handleHealth, "handleHealth");
async function checkRateLimit(env2, deviceHash) {
  const oneHourAgo = Math.floor(Date.now() / 1e3) - 3600;
  const count = await env2.DB.prepare(`
		SELECT COUNT(*) as count 
		FROM beacons 
		WHERE device_id_hash = ? AND timestamp > ?
	`).bind(deviceHash, oneHourAgo).first();
  return count.count < parseInt(env2.RATE_LIMIT_PER_HOUR || "100");
}
__name(checkRateLimit, "checkRateLimit");
async function detectAnomalies(beacon, beaconId, isSignatureValid) {
  const anomalies = [];
  const cryptoInv = beacon.cryptographic_inventory || {};
  const scanMeta = beacon.scan_metadata || {};
  const totalKeys = (cryptoInv.rsa_2048_keys || 0) + (cryptoInv.rsa_3072_keys || 0) + (cryptoInv.rsa_4096_keys || 0) + (cryptoInv.ecc_p256_keys || 0) + (cryptoInv.ecc_p384_keys || 0);
  if (totalKeys > 1e5) {
    anomalies.push({
      beacon_id: beaconId,
      anomaly_type: "HIGH_KEY_COUNT",
      severity: "medium",
      details: JSON.stringify({
        total_keys: totalKeys,
        threshold: 1e5
      })
    });
  }
  if (scanMeta.scan_duration_ms && scanMeta.scan_duration_ms < 100) {
    anomalies.push({
      beacon_id: beaconId,
      anomaly_type: "FAST_SCAN",
      severity: "low",
      details: JSON.stringify({
        scan_duration_ms: scanMeta.scan_duration_ms,
        threshold: 100
      })
    });
  }
  if (!isSignatureValid) {
    anomalies.push({
      beacon_id: beaconId,
      anomaly_type: "INVALID_SIGNATURE",
      severity: "high",
      details: JSON.stringify({
        message: "Beacon received without valid PQC signature (Header Verification Failed)"
      })
    });
  }
  return anomalies;
}
__name(detectAnomalies, "detectAnomalies");
async function logAnomalies(env2, anomalies) {
  for (const anomaly of anomalies) {
    await env2.DB.prepare(`
			INSERT INTO anomalies (beacon_id, anomaly_type, severity, details)
			VALUES (?, ?, ?, ?)
		`).bind(
      anomaly.beacon_id,
      anomaly.anomaly_type,
      anomaly.severity,
      anomaly.details
    ).run();
    if (anomaly.severity === "high" || anomaly.severity === "critical") {
      await forwardSecurityEvent(env2, {
        type: "anomaly_detected",
        severity: anomaly.severity,
        device_id: anomaly.beacon_id,
        title: `Anomaly: ${anomaly.anomaly_type}`,
        description: `Detected ${anomaly.anomaly_type} anomaly`,
        details: JSON.parse(anomaly.details)
      });
    }
  }
}
__name(logAnomalies, "logAnomalies");
export {
  index_default as default
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/post-quantum/esm/utils.js:
@noble/post-quantum/esm/_crystals.js:
@noble/post-quantum/esm/ml-dsa.js:
  (*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) *)

bcryptjs/dist/bcrypt.js:
  (**
   * @license bcrypt.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
   * Released under the Apache License, Version 2.0
   * see: https://github.com/dcodeIO/bcrypt.js for details
   *)
*/
//# sourceMappingURL=index.js.map
