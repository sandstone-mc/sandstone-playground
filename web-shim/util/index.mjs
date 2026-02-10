// Shim for util module

export function inspect(obj, options) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn(...args, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };
}

export function format(fmt, ...args) {
  let i = 0;
  return String(fmt).replace(/%[sdjifoO%]/g, (match) => {
    if (match === "%%") return "%";
    if (i >= args.length) return match;
    const arg = args[i++];
    switch (match) {
      case "%s": return String(arg);
      case "%d":
      case "%i": return parseInt(arg, 10);
      case "%f": return parseFloat(arg);
      case "%j": return JSON.stringify(arg);
      case "%o":
      case "%O": return inspect(arg);
      default: return match;
    }
  });
}

export function inherits(ctor, superCtor) {
  ctor.super_ = superCtor;
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
}

export function deprecate(fn, msg) {
  let warned = false;
  return function (...args) {
    if (!warned) {
      console.warn(msg);
      warned = true;
    }
    return fn.apply(this, args);
  };
}

export function isDeepStrictEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const types = {
  isDate: (v) => v instanceof Date,
  isRegExp: (v) => v instanceof RegExp,
  isArray: Array.isArray,
  isMap: (v) => v instanceof Map,
  isSet: (v) => v instanceof Set,
  isPromise: (v) => v instanceof Promise,
};

export default {
  inspect,
  promisify,
  format,
  inherits,
  deprecate,
  isDeepStrictEqual,
  types,
};
