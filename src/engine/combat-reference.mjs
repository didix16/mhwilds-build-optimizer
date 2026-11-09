// node_modules/immer/dist/immer.mjs
var NOTHING = /* @__PURE__ */ Symbol.for("immer-nothing");
var DRAFTABLE = /* @__PURE__ */ Symbol.for("immer-draftable");
var DRAFT_STATE = /* @__PURE__ */ Symbol.for("immer-state");
var errors = true ? [
  // All error codes, starting by 0:
  function(plugin) {
    return `The plugin for '${plugin}' has not been loaded into Immer. To enable the plugin, import and call \`enable${plugin}()\` when initializing your application.`;
  },
  function(thing) {
    return `produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '${thing}'`;
  },
  "This object has been frozen and should not be mutated",
  function(data) {
    return "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " + data;
  },
  "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.",
  "Immer forbids circular references",
  "The first or second argument to `produce` must be a function",
  "The third argument to `produce` must be a function or undefined",
  "First argument to `createDraft` must be a plain object, an array, or an immerable object",
  "First argument to `finishDraft` must be a draft returned by `createDraft`",
  function(thing) {
    return `'current' expects a draft, got: ${thing}`;
  },
  "Object.defineProperty() cannot be used on an Immer draft",
  "Object.setPrototypeOf() cannot be used on an Immer draft",
  "Immer only supports deleting array indices",
  "Immer only supports setting array indices and the 'length' property",
  function(thing) {
    return `'original' expects a draft, got: ${thing}`;
  }
  // Note: if more errors are added, the errorOffset in Patches.ts should be increased
  // See Patches.ts for additional errors
] : [];
function die(error, ...args) {
  if (true) {
    const e = errors[error];
    const msg = isFunction(e) ? e.apply(null, args) : e;
    throw new Error(`[Immer] ${msg}`);
  }
  throw new Error(
    `[Immer] minified error nr: ${error}. Full error at: https://bit.ly/3cXEKWf`
  );
}
var O = Object;
var getPrototypeOf = O.getPrototypeOf;
var CONSTRUCTOR = "constructor";
var PROTOTYPE = "prototype";
var CONFIGURABLE = "configurable";
var ENUMERABLE = "enumerable";
var WRITABLE = "writable";
var VALUE = "value";
var isDraft = (value) => !!value && !!value[DRAFT_STATE];
function isDraftable(value) {
  if (!value)
    return false;
  return isPlainObject(value) || isArray(value) || !!value[DRAFTABLE] || !!value[CONSTRUCTOR]?.[DRAFTABLE] || isMap(value) || isSet(value);
}
var objectCtorString = O[PROTOTYPE][CONSTRUCTOR].toString();
var cachedCtorStrings = /* @__PURE__ */ new WeakMap();
function isPlainObject(value) {
  if (!value || !isObjectish(value))
    return false;
  const proto = getPrototypeOf(value);
  if (proto === null || proto === O[PROTOTYPE])
    return true;
  const Ctor = O.hasOwnProperty.call(proto, CONSTRUCTOR) && proto[CONSTRUCTOR];
  if (Ctor === Object)
    return true;
  if (!isFunction(Ctor))
    return false;
  let ctorString = cachedCtorStrings.get(Ctor);
  if (ctorString === void 0) {
    ctorString = Function.toString.call(Ctor);
    cachedCtorStrings.set(Ctor, ctorString);
  }
  return ctorString === objectCtorString;
}
function each(obj, iter, strict = true) {
  if (getArchtype(obj) === 0) {
    const keys = strict ? Reflect.ownKeys(obj) : O.keys(obj);
    keys.forEach((key) => {
      iter(key, obj[key], obj);
    });
  } else {
    obj.forEach((entry, index) => iter(index, entry, obj));
  }
}
function getArchtype(thing) {
  const state = thing[DRAFT_STATE];
  return state ? state.type_ : isArray(thing) ? 1 : isMap(thing) ? 2 : isSet(thing) ? 3 : 0;
}
var has = (thing, prop, type = getArchtype(thing)) => type === 2 ? thing.has(prop) : O[PROTOTYPE].hasOwnProperty.call(thing, prop);
var get = (thing, prop, type = getArchtype(thing)) => (
  // @ts-ignore
  type === 2 ? thing.get(prop) : thing[prop]
);
var set = (thing, propOrOldValue, value, type = getArchtype(thing)) => {
  if (type === 2)
    thing.set(propOrOldValue, value);
  else if (type === 3) {
    thing.add(value);
  } else
    thing[propOrOldValue] = value;
};
function is(x, y) {
  if (x === y) {
    return x !== 0 || 1 / x === 1 / y;
  } else {
    return x !== x && y !== y;
  }
}
var isArray = Array.isArray;
var isMap = (target) => target instanceof Map;
var isSet = (target) => target instanceof Set;
var isObjectish = (target) => typeof target === "object";
var isFunction = (target) => typeof target === "function";
var isBoolean = (target) => typeof target === "boolean";
function isArrayIndex(value) {
  const n = +value;
  return Number.isInteger(n) && String(n) === value;
}
var latest = (state) => state.copy_ || state.base_;
var getFinalValue = (state) => state.modified_ ? state.copy_ : state.base_;
function shallowCopy(base, strict) {
  if (isMap(base)) {
    return new Map(base);
  }
  if (isSet(base)) {
    return new Set(base);
  }
  if (isArray(base))
    return Array[PROTOTYPE].slice.call(base);
  const isPlain = isPlainObject(base);
  if (strict === true || strict === "class_only" && !isPlain) {
    const descriptors = O.getOwnPropertyDescriptors(base);
    delete descriptors[DRAFT_STATE];
    let keys = Reflect.ownKeys(descriptors);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = descriptors[key];
      if (desc[WRITABLE] === false) {
        desc[WRITABLE] = true;
        desc[CONFIGURABLE] = true;
      }
      if (desc.get || desc.set)
        descriptors[key] = {
          [CONFIGURABLE]: true,
          [WRITABLE]: true,
          // could live with !!desc.set as well here...
          [ENUMERABLE]: desc[ENUMERABLE],
          [VALUE]: base[key]
        };
    }
    return O.create(getPrototypeOf(base), descriptors);
  } else {
    const proto = getPrototypeOf(base);
    if (proto !== null && isPlain) {
      return { ...base };
    }
    const obj = O.create(proto);
    return O.assign(obj, base);
  }
}
function freeze(obj, deep = false) {
  if (isFrozen(obj) || isDraft(obj) || !isDraftable(obj))
    return obj;
  if (getArchtype(obj) > 1) {
    O.defineProperties(obj, {
      set: dontMutateMethodOverride,
      add: dontMutateMethodOverride,
      clear: dontMutateMethodOverride,
      delete: dontMutateMethodOverride
    });
  }
  O.freeze(obj);
  if (deep)
    each(
      obj,
      (_key, value) => {
        freeze(value, true);
      },
      false
    );
  return obj;
}
function dontMutateFrozenCollections() {
  die(2);
}
var dontMutateMethodOverride = {
  [VALUE]: dontMutateFrozenCollections
};
function isFrozen(obj) {
  if (obj === null || !isObjectish(obj))
    return true;
  return O.isFrozen(obj);
}
var PluginMapSet = "MapSet";
var PluginPatches = "Patches";
var PluginArrayMethods = "ArrayMethods";
var plugins = {};
function getPlugin(pluginKey) {
  const plugin = plugins[pluginKey];
  if (!plugin) {
    die(0, pluginKey);
  }
  return plugin;
}
var isPluginLoaded = (pluginKey) => !!plugins[pluginKey];
var currentScope;
var getCurrentScope = () => currentScope;
var createScope = (parent_, immer_) => ({
  drafts_: [],
  parent_,
  immer_,
  // Whenever the modified draft contains a draft from another scope, we
  // need to prevent auto-freezing so the unowned draft can be finalized.
  canAutoFreeze_: true,
  unfinalizedDrafts_: 0,
  handledSet_: /* @__PURE__ */ new Set(),
  processedForPatches_: /* @__PURE__ */ new Set(),
  mapSetPlugin_: isPluginLoaded(PluginMapSet) ? getPlugin(PluginMapSet) : void 0,
  arrayMethodsPlugin_: isPluginLoaded(PluginArrayMethods) ? getPlugin(PluginArrayMethods) : void 0
});
function usePatchesInScope(scope, patchListener) {
  if (patchListener) {
    scope.patchPlugin_ = getPlugin(PluginPatches);
    scope.patches_ = [];
    scope.inversePatches_ = [];
    scope.patchListener_ = patchListener;
  }
}
function revokeScope(scope) {
  leaveScope(scope);
  scope.drafts_.forEach(revokeDraft);
  scope.drafts_ = null;
}
function leaveScope(scope) {
  if (scope === currentScope) {
    currentScope = scope.parent_;
  }
}
var enterScope = (immer2) => currentScope = createScope(currentScope, immer2);
function revokeDraft(draft) {
  const state = draft[DRAFT_STATE];
  if (state.type_ === 0 || state.type_ === 1)
    state.revoke_();
  else
    state.revoked_ = true;
}
function processResult(result, scope) {
  scope.unfinalizedDrafts_ = scope.drafts_.length;
  const baseDraft = scope.drafts_[0];
  const isReplaced = result !== void 0 && result !== baseDraft;
  if (isReplaced) {
    if (baseDraft[DRAFT_STATE].modified_) {
      revokeScope(scope);
      die(4);
    }
    if (isDraftable(result)) {
      result = finalize(scope, result);
    }
    const { patchPlugin_ } = scope;
    if (patchPlugin_) {
      patchPlugin_.generateReplacementPatches_(
        baseDraft[DRAFT_STATE].base_,
        result,
        scope
      );
    }
  } else {
    result = finalize(scope, baseDraft);
  }
  maybeFreeze(scope, result, true);
  revokeScope(scope);
  if (scope.patches_) {
    scope.patchListener_(scope.patches_, scope.inversePatches_);
  }
  return result !== NOTHING ? result : void 0;
}
function finalize(rootScope, value) {
  if (isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  if (!state) {
    const finalValue = handleValue(value, rootScope.handledSet_, rootScope);
    return finalValue;
  }
  if (!isSameScope(state, rootScope)) {
    return value;
  }
  if (!state.modified_) {
    return state.base_;
  }
  if (!state.finalized_) {
    const { callbacks_ } = state;
    if (callbacks_) {
      while (callbacks_.length > 0) {
        const callback = callbacks_.pop();
        callback(rootScope);
      }
    }
    generatePatchesAndFinalize(state, rootScope);
  }
  return state.copy_;
}
function maybeFreeze(scope, value, deep = false) {
  if (!scope.parent_ && scope.immer_.autoFreeze_ && scope.canAutoFreeze_) {
    freeze(value, deep);
  }
}
function markStateFinalized(state) {
  state.finalized_ = true;
  state.scope_.unfinalizedDrafts_--;
}
var isSameScope = (state, rootScope) => state.scope_ === rootScope;
var EMPTY_LOCATIONS_RESULT = [];
function updateDraftInParent(parent, draftValue, finalizedValue, originalKey) {
  const parentCopy = latest(parent);
  const parentType = parent.type_;
  if (originalKey !== void 0) {
    const currentValue = get(parentCopy, originalKey, parentType);
    if (currentValue === draftValue) {
      set(parentCopy, originalKey, finalizedValue, parentType);
      return;
    }
  }
  if (!parent.draftLocations_) {
    const draftLocations = parent.draftLocations_ = /* @__PURE__ */ new Map();
    each(parentCopy, (key, value) => {
      if (isDraft(value)) {
        const keys = draftLocations.get(value) || [];
        keys.push(key);
        draftLocations.set(value, keys);
      }
    });
  }
  const locations = parent.draftLocations_.get(draftValue) ?? EMPTY_LOCATIONS_RESULT;
  for (const location of locations) {
    set(parentCopy, location, finalizedValue, parentType);
  }
}
function registerChildFinalizationCallback(parent, child, key) {
  parent.callbacks_.push(function childCleanup(rootScope) {
    const state = child;
    if (!state || !isSameScope(state, rootScope)) {
      return;
    }
    rootScope.mapSetPlugin_?.fixSetContents(state);
    const finalizedValue = getFinalValue(state);
    updateDraftInParent(parent, state.draft_ ?? state, finalizedValue, key);
    generatePatchesAndFinalize(state, rootScope);
  });
}
function generatePatchesAndFinalize(state, rootScope) {
  const shouldFinalize = state.modified_ && !state.finalized_ && (state.type_ === 3 || state.type_ === 1 && state.allIndicesReassigned_ || (state.assigned_?.size ?? 0) > 0);
  if (shouldFinalize) {
    const { patchPlugin_ } = rootScope;
    if (patchPlugin_) {
      const basePath = patchPlugin_.getPath(state);
      if (basePath) {
        patchPlugin_.generatePatches_(state, basePath, rootScope);
      }
    }
    markStateFinalized(state);
  }
}
function handleCrossReference(target, key, value) {
  const { scope_ } = target;
  if (isDraft(value)) {
    const state = value[DRAFT_STATE];
    if (isSameScope(state, scope_)) {
      state.callbacks_.push(function crossReferenceCleanup() {
        prepareCopy(target);
        const finalizedValue = getFinalValue(state);
        updateDraftInParent(target, value, finalizedValue, key);
      });
    }
  } else if (isDraftable(value)) {
    target.callbacks_.push(function nestedDraftCleanup() {
      const targetCopy = latest(target);
      if (target.type_ === 3) {
        if (targetCopy.has(value)) {
          handleValue(value, scope_.handledSet_, scope_);
        }
      } else {
        if (get(targetCopy, key, target.type_) === value) {
          if (scope_.drafts_.length > 1 && (target.assigned_.get(key) ?? false) === true && target.copy_) {
            handleValue(
              get(target.copy_, key, target.type_),
              scope_.handledSet_,
              scope_
            );
          }
        }
      }
    });
  }
}
function handleValue(target, handledSet, rootScope) {
  if (!rootScope.immer_.autoFreeze_ && rootScope.unfinalizedDrafts_ < 1) {
    return target;
  }
  if (isDraft(target) || handledSet.has(target) || !isDraftable(target) || isFrozen(target)) {
    return target;
  }
  handledSet.add(target);
  each(target, (key, value) => {
    if (isDraft(value)) {
      const state = value[DRAFT_STATE];
      if (isSameScope(state, rootScope)) {
        const updatedValue = getFinalValue(state);
        set(target, key, updatedValue, target.type_);
        markStateFinalized(state);
      }
    } else if (isDraftable(value)) {
      handleValue(value, handledSet, rootScope);
    }
  });
  return target;
}
function createProxyProxy(base, parent) {
  const baseIsArray = isArray(base);
  const state = {
    type_: baseIsArray ? 1 : 0,
    // Track which produce call this is associated with.
    scope_: parent ? parent.scope_ : getCurrentScope(),
    // True for both shallow and deep changes.
    modified_: false,
    // Used during finalization.
    finalized_: false,
    // Track which properties have been assigned (true) or deleted (false).
    // actually instantiated in `prepareCopy()`
    assigned_: void 0,
    // The parent draft state.
    parent_: parent,
    // The base state.
    base_: base,
    // The base proxy.
    draft_: null,
    // set below
    // The base copy with any updated values.
    copy_: null,
    // Called by the `produce` function.
    revoke_: null,
    isManual_: false,
    // `callbacks` actually gets assigned in `createProxy`
    callbacks_: void 0
  };
  let target = state;
  let traps = objectTraps;
  if (baseIsArray) {
    target = [state];
    traps = arrayTraps;
  }
  const { revoke, proxy } = Proxy.revocable(target, traps);
  state.draft_ = proxy;
  state.revoke_ = revoke;
  return [proxy, state];
}
var objectTraps = {
  get(state, prop) {
    if (prop === DRAFT_STATE)
      return state;
    let arrayPlugin = state.scope_.arrayMethodsPlugin_;
    const isArrayWithStringProp = state.type_ === 1 && typeof prop === "string";
    if (isArrayWithStringProp) {
      if (arrayPlugin?.isArrayOperationMethod(prop)) {
        return arrayPlugin.createMethodInterceptor(state, prop);
      }
    }
    const source = latest(state);
    if (!has(source, prop, state.type_)) {
      return readPropFromProto(state, source, prop);
    }
    const value = source[prop];
    if (state.finalized_ || !isDraftable(value)) {
      return value;
    }
    if (isArrayWithStringProp && state.operationMethod && arrayPlugin?.isMutatingArrayMethod(
      state.operationMethod
    ) && isArrayIndex(prop)) {
      return value;
    }
    if (value === peek(state.base_, prop) || isRelocatedBaseRef(state, prop, value)) {
      prepareCopy(state);
      const childKey = state.type_ === 1 ? +prop : prop;
      const childDraft = createProxy(state.scope_, value, state, childKey);
      return state.copy_[childKey] = childDraft;
    }
    return value;
  },
  has(state, prop) {
    return prop in latest(state);
  },
  ownKeys(state) {
    return Reflect.ownKeys(latest(state));
  },
  set(state, prop, value) {
    const desc = getDescriptorFromProto(latest(state), prop);
    if (desc?.set) {
      desc.set.call(state.draft_, value);
      return true;
    }
    if (!state.modified_) {
      const current2 = peek(latest(state), prop);
      const currentState = current2?.[DRAFT_STATE];
      if (currentState && currentState.base_ === value) {
        state.copy_[prop] = value;
        state.assigned_.delete(prop);
        return true;
      }
      if (is(value, current2) && (value !== void 0 || has(state.base_, prop, state.type_)))
        return true;
      prepareCopy(state);
      markChanged(state);
    }
    if (state.copy_[prop] === value && // special case: handle new props with value 'undefined'
    (value !== void 0 || has(state.copy_, prop, state.type_)) || // special case: NaN
    Number.isNaN(value) && Number.isNaN(state.copy_[prop]))
      return true;
    state.copy_[prop] = value;
    state.assigned_.set(prop, true);
    handleCrossReference(state, prop, value);
    return true;
  },
  deleteProperty(state, prop) {
    prepareCopy(state);
    if (peek(state.base_, prop) !== void 0 || prop in state.base_) {
      state.assigned_.set(prop, false);
      markChanged(state);
    } else {
      state.assigned_.delete(prop);
    }
    if (state.copy_) {
      delete state.copy_[prop];
    }
    return true;
  },
  // Note: We never coerce `desc.value` into an Immer draft, because we can't make
  // the same guarantee in ES5 mode.
  getOwnPropertyDescriptor(state, prop) {
    const owner = latest(state);
    const desc = Reflect.getOwnPropertyDescriptor(owner, prop);
    if (!desc)
      return desc;
    return {
      [WRITABLE]: true,
      [CONFIGURABLE]: state.type_ !== 1 || prop !== "length",
      [ENUMERABLE]: desc[ENUMERABLE],
      [VALUE]: owner[prop]
    };
  },
  defineProperty() {
    die(11);
  },
  getPrototypeOf(state) {
    return getPrototypeOf(state.base_);
  },
  setPrototypeOf() {
    die(12);
  }
};
var arrayTraps = {};
for (let key in objectTraps) {
  let fn = objectTraps[key];
  arrayTraps[key] = function() {
    const args = arguments;
    args[0] = args[0][0];
    return fn.apply(this, args);
  };
}
arrayTraps.deleteProperty = function(state, prop) {
  if (isNaN(parseInt(prop)))
    die(13);
  return arrayTraps.set.call(this, state, prop, void 0);
};
arrayTraps.set = function(state, prop, value) {
  if (prop !== "length" && isNaN(parseInt(prop)))
    die(14);
  return objectTraps.set.call(this, state[0], prop, value, state[0]);
};
function peek(draft, prop) {
  const state = draft[DRAFT_STATE];
  const source = state ? latest(state) : draft;
  return source[prop];
}
function isRelocatedBaseRef(state, prop, value) {
  if (state.type_ !== 1 || !state.allIndicesReassigned_ || !isDraftable(value) || value[DRAFT_STATE]) {
    return false;
  }
  return state.baseRefs_.has(value);
}
function readPropFromProto(state, source, prop) {
  const desc = getDescriptorFromProto(source, prop);
  return desc ? VALUE in desc ? desc[VALUE] : (
    // This is a very special case, if the prop is a getter defined by the
    // prototype, we should invoke it with the draft as context!
    desc.get?.call(state.draft_)
  ) : void 0;
}
function getDescriptorFromProto(source, prop) {
  if (!(prop in source))
    return void 0;
  let proto = getPrototypeOf(source);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc)
      return desc;
    proto = getPrototypeOf(proto);
  }
  return void 0;
}
function markChanged(state) {
  if (!state.modified_) {
    state.modified_ = true;
    if (state.parent_) {
      markChanged(state.parent_);
    }
  }
}
function prepareCopy(state) {
  if (!state.copy_) {
    state.assigned_ = /* @__PURE__ */ new Map();
    state.copy_ = shallowCopy(
      state.base_,
      state.scope_.immer_.useStrictShallowCopy_
    );
  }
}
var Immer2 = class {
  constructor(config) {
    this.autoFreeze_ = true;
    this.useStrictShallowCopy_ = false;
    this.useStrictIteration_ = false;
    this.produce = (base, recipe, patchListener) => {
      if (isFunction(base) && !isFunction(recipe)) {
        const defaultBase = recipe;
        recipe = base;
        const self = this;
        return function curriedProduce(base2 = defaultBase, ...args) {
          return self.produce(base2, (draft) => recipe.call(this, draft, ...args));
        };
      }
      if (!isFunction(recipe))
        die(6);
      if (patchListener !== void 0 && !isFunction(patchListener))
        die(7);
      let result;
      if (isDraftable(base)) {
        const scope = enterScope(this);
        const proxy = createProxy(scope, base, void 0);
        let hasError = true;
        try {
          result = recipe(proxy);
          hasError = false;
        } finally {
          if (hasError)
            revokeScope(scope);
          else
            leaveScope(scope);
        }
        usePatchesInScope(scope, patchListener);
        return processResult(result, scope);
      } else if (!base || !isObjectish(base)) {
        result = recipe(base);
        if (result === void 0)
          result = base;
        if (result === NOTHING)
          result = void 0;
        if (this.autoFreeze_)
          freeze(result, true);
        if (patchListener) {
          const p = [];
          const ip = [];
          getPlugin(PluginPatches).generateReplacementPatches_(base, result, {
            patches_: p,
            inversePatches_: ip
          });
          patchListener(p, ip);
        }
        return result;
      } else
        die(1, base);
    };
    this.produceWithPatches = (base, recipe) => {
      if (isFunction(base)) {
        return (state, ...args) => this.produceWithPatches(state, (draft) => base(draft, ...args));
      }
      let patches, inversePatches;
      const result = this.produce(base, recipe, (p, ip) => {
        patches = p;
        inversePatches = ip;
      });
      return [result, patches, inversePatches];
    };
    if (isBoolean(config?.autoFreeze))
      this.setAutoFreeze(config.autoFreeze);
    if (isBoolean(config?.useStrictShallowCopy))
      this.setUseStrictShallowCopy(config.useStrictShallowCopy);
    if (isBoolean(config?.useStrictIteration))
      this.setUseStrictIteration(config.useStrictIteration);
  }
  createDraft(base) {
    if (!isDraftable(base))
      die(8);
    if (isDraft(base))
      base = current(base);
    const scope = enterScope(this);
    const proxy = createProxy(scope, base, void 0);
    proxy[DRAFT_STATE].isManual_ = true;
    leaveScope(scope);
    return proxy;
  }
  finishDraft(draft, patchListener) {
    const state = draft && draft[DRAFT_STATE];
    if (!state || !state.isManual_)
      die(9);
    const { scope_: scope } = state;
    usePatchesInScope(scope, patchListener);
    return processResult(void 0, scope);
  }
  /**
   * Pass true to automatically freeze all copies created by Immer.
   *
   * By default, auto-freezing is enabled.
   */
  setAutoFreeze(value) {
    this.autoFreeze_ = value;
  }
  /**
   * Pass true to enable strict shallow copy.
   *
   * By default, immer does not copy the object descriptors such as getter, setter and non-enumrable properties.
   */
  setUseStrictShallowCopy(value) {
    this.useStrictShallowCopy_ = value;
  }
  /**
   * Pass false to use faster iteration that skips non-enumerable properties
   * but still handles symbols for compatibility.
   *
   * By default, strict iteration is enabled (includes all own properties).
   */
  setUseStrictIteration(value) {
    this.useStrictIteration_ = value;
  }
  shouldUseStrictIteration() {
    return this.useStrictIteration_;
  }
  applyPatches(base, patches) {
    let i;
    for (i = patches.length - 1; i >= 0; i--) {
      const patch = patches[i];
      if (patch.path.length === 0 && patch.op === "replace") {
        base = patch.value;
        break;
      }
    }
    if (i > -1) {
      patches = patches.slice(i + 1);
    }
    const applyPatchesImpl = getPlugin(PluginPatches).applyPatches_;
    if (isDraft(base)) {
      return applyPatchesImpl(base, patches);
    }
    return this.produce(
      base,
      (draft) => applyPatchesImpl(draft, patches)
    );
  }
};
function createProxy(rootScope, value, parent, key) {
  const [draft, state] = isMap(value) ? getPlugin(PluginMapSet).proxyMap_(value, parent) : isSet(value) ? getPlugin(PluginMapSet).proxySet_(value, parent) : createProxyProxy(value, parent);
  const scope = parent?.scope_ ?? getCurrentScope();
  scope.drafts_.push(draft);
  state.callbacks_ = parent?.callbacks_ ?? [];
  state.key_ = key;
  if (parent && key !== void 0) {
    registerChildFinalizationCallback(parent, state, key);
  } else {
    state.callbacks_.push(function rootDraftCleanup(rootScope2) {
      rootScope2.mapSetPlugin_?.fixSetContents(state);
      const { patchPlugin_ } = rootScope2;
      if (state.modified_ && patchPlugin_) {
        patchPlugin_.generatePatches_(state, [], rootScope2);
      }
    });
  }
  return draft;
}
function current(value) {
  if (!isDraft(value))
    die(10, value);
  return currentImpl(value);
}
function currentImpl(value) {
  if (!isDraftable(value) || isFrozen(value))
    return value;
  const state = value[DRAFT_STATE];
  let copy;
  let strict = true;
  if (state) {
    if (!state.modified_)
      return state.base_;
    state.finalized_ = true;
    copy = shallowCopy(value, state.scope_.immer_.useStrictShallowCopy_);
    strict = state.scope_.immer_.shouldUseStrictIteration();
  } else {
    copy = shallowCopy(value, true);
  }
  const source = copy;
  if (isSet(copy))
    copy = /* @__PURE__ */ new Set();
  each(
    source,
    (key, childValue) => {
      set(copy, key, currentImpl(childValue));
    },
    strict
  );
  if (state) {
    state.finalized_ = false;
  }
  return copy;
}
var _globalIterator = globalThis.Iterator;
var hasIteratorFrom = typeof _globalIterator?.from === "function";
var immer = new Immer2();
var produce = immer.produce;

// src/vendor/calculator/data.ts
var WeaponTypes = [
  "Sword and Shield",
  "Dual Blades",
  "Great Sword",
  "Long Sword",
  "Hammer",
  "Hunting Horn",
  "Lance",
  "Gunlance",
  "Switch Axe",
  "Charge Blade",
  "Insect Glaive",
  "Light Bowgun",
  "Heavy Bowgun",
  "Bow"
];
var Sharpnesses = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "White",
  "Purple",
  "Ranged"
];
var SharpnessRaw = {
  Red: 0.5,
  Orange: 0.75,
  Yellow: 1,
  Green: 1.05,
  Blue: 1.2,
  White: 1.32,
  Purple: 1.39,
  Ranged: 1
};
var SharpnessEle = {
  Red: 0.25,
  Orange: 0.5,
  Yellow: 0.75,
  Green: 1,
  Blue: 1.0625,
  White: 1.15,
  Purple: 1.25,
  Ranged: 1
};
var getSharpness = (n) => {
  if (!n) return "Ranged";
  let index = 0;
  for (let i = Sharpnesses.length - 1; i >= 0; i--) {
    if (n[i] > 0) {
      index = i;
      break;
    }
  }
  const s2 = Sharpnesses[index];
  return s2;
};
var getSharpnessRaw = (n) => SharpnessRaw[getSharpness(n)];
var getSharpnessEle = (n) => SharpnessEle[getSharpness(n)];
var WeaponBuffs = {
  BowCoating: {
    name: "Coating",
    weapons: ["Bow"],
    levels: [
      { name: "Power", coatingRawMul: 1.3, rawMul: 1.3 },
      { name: "Close-range", coatingRawMul: 1.4, rawMul: 1.4 }
    ]
  },
  ChargeBladeShieldElement: {
    name: "Shield: Element Boost",
    weapons: ["Charge Blade"],
    levels: [
      {
        name: "Shield: Element Boost",
        cbShieldElement: true,
        axeRawMul: 1.1,
        impactPhialMul: 1.2,
        elePhialMul: 1.3
      }
    ]
  },
  DualBladesDemonBoost: {
    name: "Demon Boost",
    weapons: ["Dual Blades"],
    levels: [{ name: "Demon Boost", attackMul: 1.15, eleMul: 1.3 }]
  },
  HornSelfImprovement: {
    name: "Self-Improvement",
    weapons: ["Hunting Horn"],
    levels: [{ name: "Self-Improvement", attackMul: 1.2 }]
  },
  KinsectExtracts: {
    name: "Extracts",
    weapons: ["Insect Glaive"],
    levels: [
      { name: "Red + White", attackMul: 1.1 },
      { name: "Red + White + Yellow", attackMul: 1.15 }
    ]
  },
  SpiritGauge: {
    name: "Spirit Gauge",
    weapons: ["Long Sword"],
    levels: [
      { name: "White", attackMul: 1.025 },
      { name: "Yellow", attackMul: 1.05 },
      { name: "Red", attackMul: 1.1 }
    ]
  },
  SwitchAxePowerAxe: {
    name: "Power Axe",
    weapons: ["Switch Axe"],
    levels: [{ name: "Power Axe", powerAxe: true }]
  }
};
var Buffs = {
  Powercharm: {
    name: "Powercharm",
    levels: [{ name: "Powercharm", attack: 6 }]
  },
  DemonPowder: {
    name: "Demon Powder",
    levels: [{ name: "Demon Powder", attack: 10 }]
  },
  Frenzy: {
    name: "Frenzy",
    levels: [{ name: "Overcame Frenzy", affinity: 15 }]
  }
};
var SlickedBladeBuffs = {
  Wet: { name: "Wet", levels: [{ name: "Wet" }] },
  Bubbleblight: { name: "Bubbleblight", levels: [{ name: "Bubbleblight" }] }
};
var OmegaResonanceBuffs = {
  LocalResonance: {
    name: "Local Resonance",
    levels: [{ name: "Local Resonance" }]
  },
  GlobalResonance: {
    name: "Global Resonance",
    levels: [{ name: "Global Resonance" }]
  }
};
var FieldBuffs = {
  Food: {
    name: "Food",
    levels: [
      { name: "Food Attack +2", attack: 2 },
      { name: "Food Attack +5", attack: 5 }
    ]
  },
  Demondrug: {
    name: "Demondrug",
    levels: [
      { name: "Demondrug", attack: 5 },
      { name: "Mega Demondrug", attack: 7 }
    ]
  },
  MightSeedPill: {
    name: "Might Seed / Pill",
    levels: [
      { name: "Might Seed", attack: 10 },
      { name: "Might Pill", attack: 25 }
    ]
  },
  Mantle: {
    name: "Mantle",
    levels: [
      { name: "Corrupted Mantle", attackMul: 1.05, affinity: 10 },
      { name: "Evasion Mantle", attackMul: 1.2 }
    ]
  }
};
var HuntingHornBuffs = {
  HornAttackUp: {
    name: "Attack Up",
    levels: [
      { name: "Attack Up (S)", attackMul: 1.05 },
      { name: "Attack Up (L)", attackMul: 1.1 }
    ]
  },
  HornElementUp: {
    name: "Elem Attack Boost",
    levels: [{ name: "Elem Attack Up", elementMul: 1.1 }]
  },
  HornAffinityUp: {
    name: "Affinity Up",
    levels: [{ name: "Affinity Up", affinity: 15 }]
  },
  HornEchoBubble: {
    name: "Echo Bubble",
    levels: [{ name: "Attack & Affinity Up", attackMul: 1.1, affinity: 25 }]
  }
};
var CombinedBuffs = {
  ...Buffs,
  ...SlickedBladeBuffs,
  ...OmegaResonanceBuffs,
  ...WeaponBuffs,
  ...FieldBuffs,
  ...HuntingHornBuffs
};
var ArtianTypeToGunlanceShellType = {
  ["No Element"]: "Normal",
  Fire: "Normal",
  Water: "Long",
  Thunder: "Long",
  Dragon: "Long",
  Ice: "Normal",
  Poison: "Wide",
  Paralysis: "Wide",
  Sleep: "Normal",
  Blast: "Wide"
};
var ArtianElementUpgrade = {
  ["Great Sword"]: 80,
  ["Lance"]: 50,
  ["Charge Blade"]: 50,
  ["Long Sword"]: 50,
  ["Hammer"]: 50,
  ["Gunlance"]: 50,
  ["Hunting Horn"]: 50,
  ["Sword and Shield"]: 30,
  ["Switch Axe"]: 30,
  ["Insect Glaive"]: 30,
  ["Bow"]: 30,
  ["Dual Blades"]: 20,
  ["Light Bowgun"]: 0,
  ["Heavy Bowgun"]: 0
};

// src/vendor/calculator/types.ts
var ElementTypes = [
  "Dragon",
  "Fire",
  "Ice",
  "Thunder",
  "Water"
];
var StatusTypes = ["Blast", "Paralysis", "Poison", "Sleep"];
var ShellingTypes = ["Normal", "Long", "Wide"];
var isBowgunElementAmmo = (attack) => {
  return "rawEle" in attack && "elementType" in attack;
};
var ArtianTypeOptions = [
  "No Element",
  ...ElementTypes,
  ...StatusTypes
];

// src/vendor/calculator/model.ts
var sum = (...args) => {
  return args.reduce(
    (sum2, a) => a !== void 0 && a !== false ? sum2 + a : sum2,
    0
  );
};
var mul = (...args) => {
  return args.reduce(
    (sum2, a) => a !== void 0 && a !== false ? sum2 * a : sum2,
    1
  );
};
var _round = (value, places = 1) => {
  const p = 10 ** places;
  return Number((Math.round(value * p) / p).toFixed(places));
};
var round = (value, places = 1) => {
  return _round(_round(value, places + 5), places);
};
var dmg = (n) => {
  if (n > 0 && n < 1) return 1;
  return round(n);
};
var calculate = (base, multipliers = [], bonuses = []) => {
  return round(base * mul(...multipliers) + sum(...bonuses));
};
var get2 = (k, n, b2) => {
  return b2 ? b2[k] ?? n : n;
};
var getAttack = (b2) => get2("attack", 0, b2);
var getAttackMul = (b2) => get2("attackMul", 1, b2);
var getAffinity = (b2) => get2("affinity", 0, b2);
var getElement = (b2) => get2("element", 0, b2);
var getElementMul = (b2) => get2("elementMul", 1, b2);
var getStatus = (b2) => get2("status", 0, b2);
var getStatusMul = (b2) => get2("statusMul", 1, b2);
var calculateAffinity = ({
  affinity,
  buffs = {},
  target,
  rawType
}) => {
  const bonuses = [];
  Object.values(buffs).forEach((b2) => {
    if (buffs.Frenzy) bonuses.push(b2?.frenzy?.affinity);
    if (buffs.Wet) bonuses.push(b2?.wet?.affinity);
    if (buffs.Bubbleblight) bonuses.push(b2?.bubbleblight?.affinity);
    if (buffs.LocalResonance) bonuses.push(b2?.localAffinity);
    if (buffs.Synergy) bonuses.push(b2?.synergyAffinity);
  });
  const n = sum(
    affinity,
    ...Object.values(buffs).map(
      (b2) => sum(
        getAffinity(b2),
        target[rawType] >= 45 ? getAffinity(b2.weakness) : 0,
        target.wound ? getAffinity(b2.wound) : 0
      )
    ),
    ...bonuses
  );
  return n > 0 ? Math.min(n, 100) : Math.max(n, -100);
};
var calculateAverage = (hit, crit, affinity) => {
  const a = Math.abs(affinity) / 100;
  const avg = crit * a + (1 - a) * hit;
  return round(avg, 2);
};
var calculateAttack = (base, buffs, multipliers = [], bonuses = []) => {
  Object.values(buffs).forEach((b2) => {
    if (buffs.Frenzy) {
      multipliers.push(b2?.frenzy?.attackMul);
      bonuses.push(b2?.frenzy?.attack);
    }
    if (buffs.Burst) bonuses.push(b2?.burst?.attack);
    if (buffs.GlobalResonance) bonuses.push(b2?.globalAttack);
  });
  return calculate(
    base,
    [...Object.values(buffs).map(getAttackMul), ...multipliers],
    [...Object.values(buffs).map(getAttack), ...bonuses]
  );
};
var calculateElement = (base, type, buffs, multipliers = [], bonuses = [], saElementPhial) => {
  if (!base) return 0;
  buffs = produce(buffs, (d) => {
    Object.entries(d).forEach(([k, v]) => {
      if (!v || v.elementType && v.elementType !== type) delete d[k];
    });
  });
  if (buffs.Frenzy) {
    Object.values(buffs).forEach((b2) => {
      multipliers.push(b2?.frenzy?.elementMul);
    });
  }
  let cap = Math.max(base + 350, base * 1.9);
  if (saElementPhial) cap += base * 0.45;
  return Math.min(
    cap,
    calculate(
      base,
      [...Object.values(buffs).map(getElementMul), ...multipliers],
      [...Object.values(buffs).map(getElement), ...bonuses]
    )
  );
};
var calculateStatus = (base, type, buffs, multipliers = [], bonuses = []) => {
  if (!base) return 0;
  buffs = produce(buffs, (d) => {
    Object.entries(d).forEach(([k, v]) => {
      if (!v || v.statusType !== type) delete d[k];
    });
  });
  return calculate(
    base,
    [...Object.values(buffs).map(getStatusMul), ...multipliers],
    [...Object.values(buffs).map(getStatus), ...bonuses]
  );
};
var calculateRawHit = (weapon, eBuffs, atk, hitzone) => {
  if (atk.fixedRaw) return atk.fixedRaw;
  const buffs = { ...eBuffs };
  const rawType = atk.rawType ?? "Slash";
  const multipliers = [];
  const bonuses = [];
  if (atk.saType === "Axe" && buffs.SwitchAxePowerAxe?.powerAxe) {
    bonuses.push(10);
  }
  if (atk.saType === "Sword" && weapon.phial === "Power") {
    multipliers.push(1.17);
  }
  if (atk.morph && buffs["Rapid Morph"]) {
    multipliers.push(buffs["Rapid Morph"].morphAttackMul);
  }
  if (hitzone[rawType] < 45 && !atk.ignoreHzv) {
    multipliers.push(buffs["Mind's Eye"]?.rawMul);
  }
  if (buffs.Bludgeoner) {
    const { sharpnesses, bludgeonerAttackMul } = buffs.Bludgeoner;
    if (sharpnesses?.some((s2) => s2 === getSharpness(weapon.sharpness))) {
      multipliers.push(bludgeonerAttackMul);
    }
  }
  if (atk.airborne) {
    multipliers.push(buffs.Airborne?.airAttackMul);
  }
  if (atk.noExtract) {
    delete buffs.KinsectExtracts;
  }
  if (atk.shelling) {
    multipliers.push(buffs.Artillery?.artilleryShellAttackMul);
  }
  if (atk.shelling?.type && !atk.name.includes("Wyvern Fire")) {
    multipliers.push(buffs["Crackling Cornpopper"]?.cornpopperMul);
  }
  if (atk.artilleryAmmo) {
    multipliers.push(buffs.Artillery?.artilleryAmmoAttackMul);
  }
  const attack = calculateAttack(weapon.attack, buffs, multipliers, bonuses);
  return mul(
    attack,
    atk.mv / 100,
    atk.ignoreHzv ? 1 : hitzone[rawType] / 100,
    atk.rawMul ?? 1,
    atk.ignoreSharpness ? 1 : getSharpnessRaw(weapon.sharpness),
    !atk.ignoreCoating && buffs.BowCoating?.rawMul,
    atk.spreadPowerShot && buffs["Spread/Power Shots"]?.rawMul,
    atk.specialAmmo && buffs["Special Ammo Boost"]?.rawMul,
    atk.normalShot && buffs["Normal Shots"]?.rawMul,
    atk.rapidFire && buffs["Rapid Fire Up"]?.rawMul,
    atk.piercingShot && buffs["Piercing Shots"]?.rawMul,
    atk.cbAxe && buffs.ChargeBladeShieldElement?.axeRawMul,
    atk.cbPhial && buffs.ChargeBladeShieldElement?.impactPhialMul
  );
};
var calculateEleHit = (weapon, buffs, atk, hitzone) => {
  const elementType = atk.elementType ?? weapon.element?.type;
  if (!elementType) return 0;
  let eleHzv = hitzone[elementType];
  eleHzv = atk.eleHzvCap ? Math.min(eleHzv, atk.eleHzvCap) : eleHzv;
  eleHzv = eleHzv / 100;
  if (atk.fixedEle) {
    const bonusEle = atk.shelling ? buffs.Artillery?.artilleryEle ?? 0 : 0;
    return mul(sum(atk.fixedEle, bonusEle), eleHzv);
  }
  const multipliers = [];
  if (atk.saType === "Sword" && weapon.phial === "Element") {
    multipliers.push(1.45);
  }
  if (atk.saType === "Axe" && weapon.phial === "Dragon") {
    return 0;
  }
  if (atk.charge) {
    multipliers.push(buffs["Charge Master"]?.eleMul);
  }
  if (isBowgunElementAmmo(atk)) {
    const bowgunOffset = Object.values(buffs).reduce((acc, b2) => {
      if (b2?.bowgunOffset) return acc + (b2.attack ?? 0);
      return acc;
    }, 0);
    const bowgunAttack = calculateAttack(
      weapon.attack,
      buffs,
      [],
      [-bowgunOffset]
    );
    const value = mul(
      bowgunAttack,
      atk.rawEle / 10,
      atk.rapidFire && buffs["Rapid Fire Up"]?.rawMul
    );
    weapon = {
      ...weapon,
      element: { value, type: atk.elementType }
    };
  }
  if (!weapon.element) return 0;
  const uiElement = calculateElement(
    weapon.element.value,
    weapon.element.type,
    buffs,
    multipliers
  );
  return mul(
    uiElement,
    0.1,
    eleHzv,
    atk.eleMul ?? 1,
    atk.ignoreSharpness ? 1 : getSharpnessEle(weapon.sharpness),
    // atk.charge && buffs["Charge Master"]?.eleMul,
    buffs.DualBladesDemonBoost?.eleMul,
    atk.cbPhial && buffs.ChargeBladeShieldElement?.elePhialMul
  );
};
var calculateHit = (weapon, buffs, atk, target) => {
  const r = calculateRawHit(weapon, buffs, atk, target);
  const e = calculateEleHit(weapon, buffs, atk, target);
  return round(dmg(r) + dmg(e));
};
var calculateCrit = (weapon, buffs, atk, target, critMulti, eleCritMulti) => {
  const r = calculateRawHit(weapon, buffs, atk, target);
  const e = calculateEleHit(weapon, buffs, atk, target);
  return round(dmg(r * critMulti) + dmg(e * eleCritMulti));
};
var calculateHandicraft = (weapon, level) => {
  let points = level * 10;
  const w = produce(weapon, (d) => {
    let baseIndex = d.sharpness.reduce(
      (acc, n, i) => n > 0 ? i : acc,
      0
    );
    let bonusIndex = 0;
    while (points > 0) {
      if (bonusIndex > 3) break;
      const limit = d.handicraft[bonusIndex];
      const bonus = points > limit ? limit : points;
      d.sharpness[baseIndex] += bonus;
      points -= bonus;
      if (bonus == limit) {
        baseIndex += 1;
        bonusIndex += 1;
      }
    }
  });
  return w.sharpness;
};

// src/vendor/calculator/skills.ts
var LightGroup = ["Dual Blades", "Bow"];
var HeavyGroup = ["Great Sword", "Hunting Horn"];
var BowgunGroup = ["Light Bowgun", "Heavy Bowgun"];
var OthersGroup = [
  "Sword and Shield",
  "Long Sword",
  "Hammer",
  "Switch Axe",
  "Charge Blade",
  "Insect Glaive",
  "Lance",
  "Gunlance"
];
var skill = (n) => ({
  levels: Array.from(Array(n).keys()).reduce(
    (acc, i) => {
      acc[i + 1] = {};
      return acc;
    },
    {}
  )
});
var UnsupportedWeaponSkills = {
  Ballistics: skill(3),
  "Bladescale Honing": skill(1),
  "Bladescale Loading": skill(1),
  "Blast Functionality": skill(1),
  "Charge Up": skill(1),
  "Critical Status": skill(3),
  "Convert Thunder Resistance": skill(1),
  "Exhaust Functionality": skill(1),
  "Evading Reload": skill(1),
  Focus: skill(3),
  Guard: skill(3),
  "Guard Up": skill(3),
  "Horn Maestro": skill(2),
  "Load Shells": skill(2),
  "Master's Touch": skill(1),
  "Para Functionality": skill(1),
  "Poison Duration Up": skill(1),
  "Poison Functionality": skill(1),
  "Power Prolonger": skill(3),
  "Protective Polish": skill(3),
  "Razor Sharp": skill(3),
  "Sleep Functionality": skill(1),
  Slugger: skill(3),
  "Speed Sharpening": skill(2),
  "Stamina Thief": skill(3),
  "Synthetic Shield": skill(1),
  "Whiteflame Torrent": skill(1)
};
var WeaponSkills = {
  ["Airborne"]: {
    levels: {
      1: { name: "Airborne 1", airAttackMul: 1.1 }
    }
  },
  ["Artillery"]: {
    levels: {
      1: {
        name: "Artillery 1",
        artilleryEle: 3,
        artilleryShellAttackMul: 1.05,
        artilleryAmmoAttackMul: 1.1
      },
      2: {
        name: "Artillery 2",
        artilleryEle: 6,
        artilleryShellAttackMul: 1.1,
        artilleryAmmoAttackMul: 1.2
      },
      3: {
        name: "Artillery 3",
        artilleryEle: 9,
        artilleryShellAttackMul: 1.15,
        artilleryAmmoAttackMul: 1.3
      }
    }
  },
  ["Attack Boost"]: {
    levels: {
      1: { name: "Attack Boost 1", attack: 3 },
      2: { name: "Attack Boost 2", attack: 5 },
      3: { name: "Attack Boost 3", attack: 7 },
      4: {
        name: "Attack Boost 4",
        attack: 8,
        attackMul: 1.02
      },
      5: {
        name: "Attack Boost 5",
        attack: 9,
        attackMul: 1.04
      }
    }
  },
  ["Blast Attack"]: {
    levels: {
      1: { name: "Blast Attack 1", statusType: "Blast", status: 40 },
      2: {
        name: "Blast Attack 2",
        statusType: "Blast",
        status: 50,
        statusMul: 1.1
      },
      3: {
        name: "Blast Attack 3",
        statusType: "Blast",
        status: 60,
        statusMul: 1.2
      }
    }
  },
  ["Bludgeoner"]: {
    levels: {
      1: {
        name: "Bludgeoner 1",
        sharpnesses: ["Yellow"],
        bludgeonerAttackMul: 1.05
      },
      2: {
        name: "Bludgeoner 2",
        sharpnesses: ["Yellow"],
        bludgeonerAttackMul: 1.1
      },
      3: {
        name: "Bludgeoner 3",
        sharpnesses: ["Yellow", "Green"],
        bludgeonerAttackMul: 1.1
      }
    }
  },
  ["Charge Master"]: {
    groups: [
      {
        weapons: ["Bow"],
        levels: {
          1: { name: "Charge Master 1", eleMul: 1.05 },
          2: { name: "Charge Master 2", eleMul: 1.1 },
          3: { name: "Charge Master 3", eleMul: 1.15 }
        }
      },
      {
        weapons: [
          "Charge Blade",
          "Dual Blades",
          "Great Sword",
          "Gunlance",
          "Hammer",
          "Heavy Bowgun",
          "Hunting Horn",
          "Insect Glaive",
          "Lance",
          "Light Bowgun",
          "Long Sword",
          "Switch Axe",
          "Sword and Shield"
        ],
        levels: {
          1: { name: "Charge Master 1", eleMul: 1.15 },
          2: { name: "Charge Master 2", eleMul: 1.2 },
          3: { name: "Charge Master 3", eleMul: 1.25 }
        }
      }
    ]
  },
  "Crackling Cornpopper": {
    toggle: true,
    levels: {
      1: { name: "Crackling Cornpopper 1", cornpopperMul: 1.35 }
    }
  },
  ["Critical Boost"]: {
    levels: {
      1: { name: "Critical Boost 1", criticalBoost: 1.28 },
      2: { name: "Critical Boost 2", criticalBoost: 1.31 },
      3: { name: "Critical Boost 3", criticalBoost: 1.34 },
      4: { name: "Critical Boost 4", criticalBoost: 1.37 },
      5: { name: "Critical Boost 5", criticalBoost: 1.4 }
    }
  },
  ["Critical Draw"]: {
    uptime: true,
    levels: {
      1: { name: "Critical Draw 1", affinity: 50 },
      2: { name: "Critical Draw 2", affinity: 75 },
      3: { name: "Critical Draw 3", affinity: 100 }
    }
  },
  ["Critical Element"]: {
    groups: [
      {
        weapons: [
          "Long Sword",
          "Switch Axe",
          "Sword and Shield",
          "Dual Blades",
          "Lance",
          "Gunlance",
          "Charge Blade",
          "Insect Glaive",
          "Light Bowgun",
          "Bow"
        ],
        levels: {
          1: { name: "Critical Element 1", criticalElement: 1.05 },
          2: { name: "Critical Element 2", criticalElement: 1.1 },
          3: { name: "Critical Element 3", criticalElement: 1.15 }
        }
      },
      {
        weapons: ["Great Sword", "Hunting Horn", "Hammer", "Heavy Bowgun"],
        levels: {
          1: { name: "Critical Element 1", criticalElement: 1.07 },
          2: { name: "Critical Element 2", criticalElement: 1.14 },
          3: { name: "Critical Element 3", criticalElement: 1.21 }
        }
      }
    ]
  },
  ["Critical Eye"]: {
    levels: {
      1: { name: "Critical Eye 1", affinity: 4 },
      2: { name: "Critical Eye 2", affinity: 8 },
      3: { name: "Critical Eye 3", affinity: 12 },
      4: { name: "Critical Eye 4", affinity: 16 },
      5: { name: "Critical Eye 5", affinity: 20 }
    }
  },
  Darkside: {
    uptime: true,
    levels: {
      1: { name: "Darkside 1", attackMul: 1.1 }
    }
  },
  ["Dragon Attack"]: {
    levels: {
      1: { name: "Dragon Attack 1", elementType: "Dragon", element: 40 },
      2: {
        name: "Dragon Attack 2",
        elementType: "Dragon",
        element: 50,
        elementMul: 1.1
      },
      3: {
        name: "Dragon Attack 3",
        elementType: "Dragon",
        element: 60,
        elementMul: 1.2
      }
    }
  },
  ["Fire Attack"]: {
    levels: {
      1: { name: "Fire Attack 1", elementType: "Fire", element: 40 },
      2: {
        name: "Fire Attack 2",
        elementType: "Fire",
        element: 50,
        elementMul: 1.1
      },
      3: {
        name: "Fire Attack 3",
        elementType: "Fire",
        element: 60,
        elementMul: 1.2
      }
    }
  },
  ["Handicraft"]: {
    levels: {
      1: { name: "Handicraft 1", handicraft: 10 },
      2: { name: "Handicraft 2", handicraft: 20 },
      3: { name: "Handicraft 3", handicraft: 30 },
      4: { name: "Handicraft 4", handicraft: 40 },
      5: { name: "Handicraft 5", handicraft: 50 }
    }
  },
  ["Ice Attack"]: {
    levels: {
      1: { name: "Ice Attack 1", elementType: "Ice", element: 40 },
      2: {
        name: "Ice Attack 2",
        elementType: "Ice",
        element: 50,
        elementMul: 1.1
      },
      3: {
        name: "Ice Attack 3",
        elementType: "Ice",
        element: 60,
        elementMul: 1.2
      }
    }
  },
  ["Mind's Eye"]: {
    levels: {
      1: { name: "Mind's Eye 1", rawMul: 1.1 },
      2: { name: "Mind's Eye 2", rawMul: 1.15 },
      3: { name: "Mind's Eye 3", rawMul: 1.3 }
    }
  },
  ["Normal Shots"]: {
    levels: {
      1: { name: "Normal Shots 1", rawMul: 1.05 }
    }
  },
  ["Offensive Guard"]: {
    uptime: true,
    levels: {
      1: { name: "Offensive Guard 1", attackMul: 1.05 },
      2: { name: "Offensive Guard 2", attackMul: 1.1 },
      3: { name: "Offensive Guard 3", attackMul: 1.15 }
    }
  },
  ["Opening Shot"]: {
    toggle: true,
    levels: {
      1: {
        name: "Opening Shot 1",
        attack: 5,
        bowgunOffset: true,
        elementMul: 1.1
      },
      2: {
        name: "Opening Shot 2",
        attack: 10,
        bowgunOffset: true,
        elementMul: 1.1
      },
      3: {
        name: "Opening Shot 3",
        attack: 15,
        bowgunOffset: true,
        elementMul: 1.1
      }
    }
  },
  ["Paralysis Attack"]: {
    levels: {
      1: { name: "Paralysis Attack 1", statusType: "Paralysis", status: 40 },
      2: {
        name: "Paralysis Attack 2",
        statusType: "Paralysis",
        status: 50,
        statusMul: 1.1
      },
      3: {
        name: "Paralysis Attack 3",
        statusType: "Paralysis",
        status: 60,
        statusMul: 1.2
      }
    }
  },
  ["Piercing Shots"]: {
    levels: {
      1: { name: "Piercing Shots 1", rawMul: 1.05 }
    }
  },
  ["Poison Attack"]: {
    levels: {
      1: { name: "Poison Attack 1", statusType: "Poison", status: 40 },
      2: {
        name: "Poison Attack 2",
        statusType: "Poison",
        status: 50,
        statusMul: 1.1
      },
      3: {
        name: "Poison Attack 3",
        statusType: "Poison",
        status: 60,
        statusMul: 1.2
      }
    }
  },
  ["Punishing Draw"]: {
    uptime: true,
    levels: {
      1: { name: "Punishing Draw 1", attack: 3 },
      2: { name: "Punishing Draw 2", attack: 5 },
      3: { name: "Punishing Draw 3", attack: 7 }
    }
  },
  ["Rapid Fire Up"]: {
    levels: {
      1: { name: "Rapid Fire Up 1", rawMul: 1.05 }
    }
  },
  ["Rapid Morph"]: {
    levels: {
      1: { name: "Rapid Morph 1" },
      2: { name: "Rapid Morph 2", morphAttackMul: 1.1 },
      3: { name: "Rapid Morph 3", morphAttackMul: 1.2 }
    }
  },
  ["Sleep Attack"]: {
    levels: {
      1: { name: "Sleep Attack 1", statusType: "Sleep", status: 40 },
      2: {
        name: "Sleep Attack 2",
        statusType: "Sleep",
        status: 50,
        statusMul: 1.1
      },
      3: {
        name: "Sleep Attack 3",
        statusType: "Sleep",
        status: 60,
        statusMul: 1.2
      }
    }
  },
  "Slicked Blade": {
    levels: {
      1: {
        name: "Slicked Blade 1",
        wet: { affinity: 3 },
        bubbleblight: { affinity: 7 }
      },
      2: {
        name: "Slicked Blade 2",
        wet: { affinity: 6 },
        bubbleblight: { affinity: 14 }
      },
      3: {
        name: "Slicked Blade 3",
        wet: { affinity: 9 },
        bubbleblight: { affinity: 21 }
      }
    }
  },
  ["Special Ammo Boost"]: {
    levels: {
      1: { name: "Special Ammo Boost 1", rawMul: 1.1 },
      2: { name: "Special Ammo Boost 2", rawMul: 1.2 }
    }
  },
  ["Spread/Power Shots"]: {
    levels: {
      1: { name: "Spread/Power Shots 1", rawMul: 1.05 }
    }
  },
  Synergy: {
    uptime: true,
    levels: {
      1: { name: "Synergy 1", affinity: 15 }
      // 25 with Omega 4-pc?
    }
  },
  ["Tetrad Shot"]: {
    description: "Increases Affinity of Bowgun ammo and Bow Coatings by 8/10/12% from the 4th shot onwards (first checkbox). Attack +3/6/10 and 5% Element on the 4th and 6th shot (second checkbox).",
    levels: {
      1: {
        name: "Tetrad Shot 1",
        tetrad: {
          affinity: 8,
          attack: 3,
          bowgunOffset: true,
          elementMul: 1.05
        }
      },
      2: {
        name: "Tetrad Shot 2",
        tetrad: {
          affinity: 10,
          attack: 6,
          bowgunOffset: true,
          elementMul: 1.05
        }
      },
      3: {
        name: "Tetrad Shot 3",
        tetrad: {
          affinity: 12,
          attack: 10,
          bowgunOffset: true,
          elementMul: 1.05
        }
      }
    }
  },
  ["Thunder Attack"]: {
    levels: {
      1: { name: "Thunder Attack 1", elementType: "Thunder", element: 40 },
      2: {
        name: "Thunder Attack 2",
        elementType: "Thunder",
        element: 50,
        elementMul: 1.1
      },
      3: {
        name: "Thunder Attack 3",
        elementType: "Thunder",
        element: 60,
        elementMul: 1.2
      }
    }
  },
  ["Water Attack"]: {
    levels: {
      1: { name: "Water Attack 1", elementType: "Water", element: 40 },
      2: {
        name: "Water Attack 2",
        elementType: "Water",
        element: 50,
        elementMul: 1.1
      },
      3: {
        name: "Water Attack 3",
        elementType: "Water",
        element: 60,
        elementMul: 1.2
      }
    }
  }
};
var UnsupportedArmorSkills = {
  ["Adaptability"]: skill(2),
  ["Aquatic/Oilsilt Mobility"]: skill(2),
  ["Bind Resistance"]: skill(3),
  ["Blast Resistance"]: skill(3),
  ["Bleeding Resistance"]: skill(3),
  ["Blindsider"]: skill(1),
  ["Blight Resistance"]: skill(3),
  ["Bombardier"]: skill(3),
  ["Botanist"]: skill(4),
  ["Cliffhanger"]: skill(1),
  ["Constitution"]: skill(5),
  ["Divine Blessing"]: skill(3),
  ["Dragon Resistance"]: skill(3),
  ["Earplugs"]: skill(3),
  ["Entomologist"]: skill(1),
  ["Evade Extender"]: skill(3),
  ["Evade Window"]: skill(5),
  ["Fire Resistance"]: skill(3),
  ["Flayer"]: skill(5),
  ["Flinch Free"]: skill(3),
  ["Free Meal"]: skill(3),
  ["Geologist"]: skill(3),
  ["Hunger Resistance"]: skill(3),
  ["Ice Resistance"]: skill(3),
  ["Intimidator"]: skill(3),
  ["Iron Skin"]: skill(3),
  ["Item Prolonger"]: skill(3),
  ["Jump Master"]: skill(1),
  ["Leap of Faith"]: skill(1),
  ["Marathon Runner"]: skill(3),
  ["Mushroomancer"]: skill(3),
  ["Outdoorsman"]: skill(1),
  ["Palico Rally"]: skill(5),
  ["Paralysis Resistance"]: skill(3),
  ["Partbreaker"]: skill(3),
  ["Poison Resistance"]: skill(3),
  ["Quick Sheathe"]: skill(3),
  ["Recovery Speed"]: skill(3),
  ["Recovery Up"]: skill(3),
  ["Self-Improvement"]: skill(1),
  ["Shock Absorber"]: skill(1),
  ["Sleep Resistance"]: skill(3),
  ["Speed Eating"]: skill(3),
  ["Stamina Surge"]: skill(3),
  ["Stench Resistance"]: skill(2),
  ["Stun Resistance"]: skill(3),
  ["Survival Expert"]: skill(3),
  ["Tool Specialist"]: skill(5),
  ["Tremor Resistance"]: skill(3),
  ["Water Resistance"]: skill(3),
  ["Wide-Range"]: skill(5),
  ["Windproof"]: skill(3)
};
var ArmorSkills = {
  ["Adrenaline Rush"]: {
    uptime: true,
    levels: {
      1: { name: "Adrenaline Rush 1", attack: 10 },
      2: { name: "Adrenaline Rush 2", attack: 15 },
      3: { name: "Adrenaline Rush 3", attack: 20 },
      4: { name: "Adrenaline Rush 4", attack: 25 },
      5: { name: "Adrenaline Rush 5", attack: 30 }
    }
  },
  Agitator: {
    uptime: true,
    levels: {
      1: { name: "Agitator 1", attack: 4, affinity: 3 },
      2: { name: "Agitator 2", attack: 8, affinity: 5 },
      3: { name: "Agitator 3", attack: 12, affinity: 7 },
      4: { name: "Agitator 4", attack: 16, affinity: 10 },
      5: { name: "Agitator 5", attack: 20, affinity: 15 }
    }
  },
  Ambush: {
    description: "Increases Attack  by 5/10/15% for 30s after a successful Sneak Attack.",
    uptime: true,
    levels: {
      1: { name: "Ambush 1", attackMul: 1.05 },
      2: { name: "Ambush 2", attackMul: 1.1 },
      3: { name: "Ambush 3", attackMul: 1.15 }
    }
  },
  Antivirus: {
    description: "Increases recovery rate from Frenzy. Affinity +3/6/10% after overcoming Frenzy.",
    levels: {
      1: { name: "Antivirus 1", frenzy: { affinity: 3 } },
      2: { name: "Antivirus 2", frenzy: { affinity: 6 } },
      3: { name: "Antivirus 3", frenzy: { affinity: 10 } }
    }
  },
  Burst: {
    uptime: true,
    groups: [
      {
        weapons: ["Dual Blades"],
        levels: {
          1: { name: "Burst 1", attack: 8, element: 40 },
          2: { name: "Burst 2", attack: 10, element: 60 },
          3: { name: "Burst 3", attack: 12, element: 80 },
          4: { name: "Burst 4", attack: 15, element: 100 },
          5: { name: "Burst 5", attack: 18, element: 120 }
        }
      },
      {
        weapons: ["Bow"],
        levels: {
          1: { name: "Burst 1", attack: 6, element: 40 },
          2: { name: "Burst 2", attack: 7, element: 60 },
          3: { name: "Burst 3", attack: 8, element: 80 },
          4: { name: "Burst 4", attack: 9, element: 100 },
          5: { name: "Burst 5", attack: 10, element: 120 }
        }
      },
      {
        weapons: BowgunGroup,
        levels: {
          1: { name: "Burst 1", attack: 6 },
          2: { name: "Burst 2", attack: 7 },
          3: { name: "Burst 3", attack: 8 },
          4: { name: "Burst 4", attack: 9 },
          5: { name: "Burst 5", attack: 10 }
        }
      },
      {
        weapons: HeavyGroup,
        levels: {
          1: { name: "Burst 1", attack: 10, element: 80 },
          2: { name: "Burst 2", attack: 12, element: 100 },
          3: { name: "Burst 3", attack: 14, element: 120 },
          4: { name: "Burst 4", attack: 16, element: 160 },
          5: { name: "Burst 5", attack: 18, element: 200 }
        }
      },
      {
        weapons: OthersGroup,
        levels: {
          1: { name: "Burst 1", attack: 8, element: 60 },
          2: { name: "Burst 2", attack: 10, element: 80 },
          3: { name: "Burst 3", attack: 12, element: 100 },
          4: { name: "Burst 4", attack: 15, element: 120 },
          5: { name: "Burst 5", attack: 18, element: 140 }
        }
      }
    ]
  },
  Coalescence: {
    uptime: true,
    groups: [
      {
        weapons: [
          "Long Sword",
          "Dual Blades",
          "Sword and Shield",
          "Lance",
          "Insect Glaive",
          "Bow"
        ],
        levels: {
          1: { name: "Coalescence 1", statusMul: 1.05, elementMul: 1.05 },
          2: { name: "Coalescence 2", statusMul: 1.1, elementMul: 1.1 },
          3: { name: "Coalescence 3", statusMul: 1.15, elementMul: 1.15 }
        }
      },
      {
        weapons: [
          "Great Sword",
          "Hammer",
          "Hunting Horn",
          "Gunlance",
          "Switch Axe",
          "Charge Blade",
          "Light Bowgun",
          "Heavy Bowgun"
        ],
        levels: {
          1: { name: "Coalescence 1", statusMul: 1.05, elementMul: 1.1 },
          2: { name: "Coalescence 2", statusMul: 1.1, elementMul: 1.2 },
          3: { name: "Coalescence 3", statusMul: 1.15, elementMul: 1.3 }
        }
      }
    ]
  },
  ["Convert Element"]: {
    uptime: true,
    levels: {
      1: { name: "Convert Element 1", elementType: "Dragon", element: 80 },
      2: { name: "Convert Element 2", elementType: "Dragon", element: 120 },
      3: { name: "Convert Element 3", elementType: "Dragon", element: 180 }
    }
  },
  Counterstrike: {
    uptime: true,
    levels: {
      1: { name: "Counterstrike 1", attack: 10 },
      2: { name: "Counterstrike 2", attack: 15 },
      3: { name: "Counterstrike 3", attack: 25 }
    }
  },
  "Defense Boost": {
    levels: {
      1: { name: "Defense Boost 1", defense: 5 },
      2: { name: "Defense Boost 2", defense: 10 },
      3: { name: "Defense Boost 3", defense: 10, defenseMul: 1.05 },
      4: { name: "Defense Boost 4", defense: 20, defenseMul: 1.05, allRes: 3 },
      5: { name: "Defense Boost 5", defense: 20, defenseMul: 1.08, allRes: 3 },
      6: { name: "Defense Boost 6", defense: 25, defenseMul: 1.08, allRes: 5 },
      7: { name: "Defense Boost 7", defense: 25, defenseMul: 1.1, allRes: 5 }
    }
  },
  ["Elemental Absorption"]: {
    uptime: true,
    groups: [
      {
        weapons: LightGroup,
        levels: {
          1: { name: "Elemental Absorption 1", element: 30 },
          2: { name: "Elemental Absorption 2", element: 40 },
          3: { name: "Elemental Absorption 3", element: 50 }
        }
      },
      {
        weapons: HeavyGroup,
        levels: {
          1: { name: "Elemental Absorption 1", element: 50 },
          2: { name: "Elemental Absorption 2", element: 80 },
          3: { name: "Elemental Absorption 3", element: 100 }
        }
      },
      {
        weapons: [...OthersGroup, ...BowgunGroup],
        levels: {
          1: { name: "Elemental Absorption 1", element: 40 },
          2: { name: "Elemental Absorption 2", element: 50 },
          3: { name: "Elemental Absorption 3", element: 60 }
        }
      }
    ]
  },
  Foray: {
    uptime: true,
    levels: {
      1: { name: "Foray 1", attack: 6 },
      2: { name: "Foray 2", attack: 8, affinity: 5 },
      3: { name: "Foray 3", attack: 10, affinity: 10 },
      4: { name: "Foray 4", attack: 12, affinity: 15 },
      5: { name: "Foray 5", attack: 15, affinity: 20 }
    }
  },
  Heroics: {
    uptime: true,
    levels: {
      1: { name: "Heroics 1" },
      2: { name: "Heroics 2", attackMul: 1.05 },
      3: { name: "Heroics 3", attackMul: 1.05 },
      4: { name: "Heroics 4", attackMul: 1.1 },
      5: { name: "Heroics 5", attackMul: 1.3 }
    }
  },
  ["Latent Power"]: {
    uptime: true,
    levels: {
      1: { name: "Latent Power 1", affinity: 10 },
      2: { name: "Latent Power 2", affinity: 20 },
      3: { name: "Latent Power 3", affinity: 30 },
      4: { name: "Latent Power 4", affinity: 40 },
      5: { name: "Latent Power 5", affinity: 50 }
    }
  },
  ["Maximum Might"]: {
    uptime: true,
    levels: {
      1: { name: "Maximum Might 1", affinity: 10 },
      2: { name: "Maximum Might 2", affinity: 20 },
      3: { name: "Maximum Might 3", affinity: 30 }
    }
  },
  "Peak Performance": {
    uptime: true,
    levels: {
      1: { name: "Peak Performance 1", attack: 3 },
      2: { name: "Peak Performance 2", attack: 6 },
      3: { name: "Peak Performance 3", attack: 10 },
      4: { name: "Peak Performance 4", attack: 15 },
      5: { name: "Peak Performance 5", attack: 20 }
    }
  },
  Resentment: {
    uptime: true,
    levels: {
      1: { name: "Resentment 1", attack: 5 },
      2: { name: "Resentment 2", attack: 10 },
      3: { name: "Resentment 3", attack: 15 },
      4: { name: "Resentment 4", attack: 20 },
      5: { name: "Resentment 5", attack: 25 }
    }
  },
  "Thunder Resistance": {
    levels: {
      1: { name: "Thunder Resistance 1", thunderRes: 6 },
      2: { name: "Thunder Resistance 2", thunderRes: 12 },
      3: { name: "Thunder Resistance 3", thunderRes: 20, defense: 10 }
    }
  },
  ["Weakness Exploit"]: {
    levels: {
      1: {
        name: "Weakness Exploit 1",
        weakness: { affinity: 5 },
        wound: { affinity: 3 }
      },
      2: {
        name: "Weakness Exploit 2",
        weakness: { affinity: 10 },
        wound: { affinity: 5 }
      },
      3: {
        name: "Weakness Exploit 3",
        weakness: { affinity: 15 },
        wound: { affinity: 10 }
      },
      4: {
        name: "Weakness Exploit 4",
        weakness: { affinity: 20 },
        wound: { affinity: 15 }
      },
      5: {
        name: "Weakness Exploit 5",
        weakness: { affinity: 30 },
        wound: { affinity: 20 }
      }
    }
  }
};
var UnsupportedGroupSkills = {
  ["Alluring Pelt"]: { levels: { 3: { name: "Diversion" } } },
  "Festival Spirit": { levels: { 3: { name: "Carving Master" } } },
  ["Flexible Leathercraft"]: { levels: { 3: { name: "Hunter Gatherer" } } },
  ["Fortifying Pelt"]: { levels: { 3: { name: "Fortify" } } },
  ["Glory's Favor"]: { levels: { 3: { name: "Luck" } } },
  ["Guardian's Protection"]: { levels: { 3: { name: "Ward of Wyveria" } } },
  ["Guardian's Pulse"]: { levels: { 3: { name: "Wylk Burst" } } },
  ["Imparted Wisdom"]: { levels: { 3: { name: "Forager's Luck" } } },
  ["Master of the Fist"]: { levels: { 3: { name: "Satsui no Hado" } } },
  ["Neopteron Alert"]: { levels: { 3: { name: "Honey Hunter" } } },
  ["Neopteron Camouflage"]: { levels: { 3: { name: "Fleetfoot" } } },
  ["Scale Layering"]: { levels: { 3: { name: "Adrenaline" } } },
  ["Scaling Prowess"]: { levels: { 3: { name: "Master Mounter" } } }
};
var GroupSkills = {
  ["Buttery Leathercraft"]: {
    uptime: true,
    levels: { 3: { name: "Affinity Sliding", affinity: 30 } }
  },
  ["Lord's Favor"]: {
    uptime: true,
    levels: { 3: { name: "Inspiration", attack: 10 } }
  },
  ["Lord's Fury"]: {
    uptime: true,
    levels: { 3: { name: "Resuscitate ", attack: 10 } }
  },
  ["Lord's Soul"]: {
    uptime: true,
    levels: { 3: { name: "Guts (Tenacity)", attackMul: 1.05 } }
  }
};
var UnsupportedSeriesSkills = {
  ["Arkveld's Hunger"]: {
    levels: {
      2: { name: "Hasten Recovery I" },
      4: { name: "Hasten Recovery II" }
    }
  },
  ["Gravios's Protection"]: {
    levels: {
      2: { name: "Flawless Armor I" },
      4: { name: "Flawless Armor II" }
    }
  },
  ["Rey Dau's Voltage"]: {
    levels: {
      2: { name: "Thunderous Roar I" },
      4: { name: "Thunderous Roar II" }
    }
  },
  ["Uth Duna's Cover"]: {
    levels: {
      2: { name: "Protective Veil I" },
      4: { name: "Protective Veil II" }
    }
  },
  ["Fulgur Anjanath's Will"]: {
    levels: { 2: { name: "Second Wind I" }, 4: { name: "Second Wind II" } }
  },
  ["Guardian Arkveld's Vitality"]: {
    levels: { 2: { name: "Decimator I" }, 4: { name: "Decimator II" } }
  },
  "Mizutsune's Prowess": {
    levels: { 2: { name: "Bubbly Dance I" }, 4: { name: "Bubbly Dance II" } }
  },
  ["Nu Udra's Mutiny"]: {
    levels: {
      2: { name: "Bad Blood I" },
      4: { name: "Bad Blood II" }
    }
  },
  ["Rathalos's Flare"]: {
    levels: { 2: { name: "Scorcher I" }, 4: { name: "Scorcher II" } }
  },
  "Zoh Shia's Pulse": {
    levels: {
      2: { name: "Super Recovery I" },
      4: { name: "Super Recovery II" }
    }
  }
};
var SeriesSkills = {
  ["Blangonga's Spirit"]: {
    uptime: true,
    levels: {
      2: { name: "War Cry I", attack: 10 },
      4: { name: "War Cry II", attack: 20 }
    }
  },
  "Blossomdance Prayer": {
    toggle: true,
    levels: {
      2: { name: "Blossomdance Boon I" },
      4: { name: "Blossomdance Boon II", attackMul: 1.09 }
    }
  },
  ["Doshaguma's Might"]: {
    uptime: true,
    levels: {
      2: { name: "Powerhouse I", attack: 10 },
      4: { name: "Powerhouse II", attack: 25 }
    }
  },
  ["Ebony Odogaron's Power"]: {
    levels: {
      2: { name: "Burst Boost I", burst: { attack: 8 } },
      4: { name: "Burst Boost II", burst: { attack: 18 } }
    }
  },
  "Flamefete Prayer": {
    toggle: true,
    levels: {
      2: { name: "Flamefete Boon I" },
      4: { name: "Flamefete Boon II", attackMul: 1.09 }
    }
  },
  Gogmapocalypse: {
    uptime: true,
    levels: {
      2: { name: "Mutual Hostility I", element: 20, eleMul: 20 },
      4: { name: "Mutual Hostility II", element: 40, eleMul: 30 }
    }
  },
  ["Gore Magala's Tyranny"]: {
    levels: {
      2: { name: "Black Eclipse I" },
      4: { name: "Black Eclipse II", attack: 10, frenzy: { attack: 5 } }
    }
  },
  ["Jin Dahaad's Revolt"]: {
    uptime: true,
    levels: {
      2: { name: "Binding Counter I", attack: 25 },
      4: { name: "Binding Counter II", attack: 50 }
    }
  },
  "Leviathan's Fury": {
    uptime: true,
    levels: {
      2: { name: "Azure Bolt I", affinity: 15 },
      4: { name: "Azure Bolt II", affinity: 15 }
    }
  },
  "Omega Resonance": {
    levels: {
      2: { name: "Resonance I", localAffinity: 20, globalAttack: 10 },
      4: {
        name: "Resonance II",
        localAffinity: 40,
        globalAttack: 20,
        synergyAffinity: 10
      }
    }
  },
  "Seregios's Tenacity": {
    uptime: true,
    levels: {
      2: { name: "Razor's Edge I" },
      4: { name: "Razor's Edge II", attackMul: 1.05 }
    }
  },
  "Soul of the Dark Knight": {
    uptime: true,
    levels: {
      2: { name: "Dark Arts", elementMul: 1.2 },
      4: { name: "The Blackest Knight", elementMul: 1.2 }
    }
  },
  ["Xu Wu's Vigor"]: {
    uptime: true,
    levels: {
      2: { name: "Protein Fiend I", attack: 15 },
      4: { name: "Protein Fiend II", attack: 25 }
    }
  }
};
var GroupSkillsCombined = {
  ...UnsupportedGroupSkills,
  ...GroupSkills
};
var SeriesSkillsCombined = {
  ...UnsupportedSeriesSkills,
  ...SeriesSkills
};
var WeaponArmorSkills = {
  ...UnsupportedWeaponSkills,
  ...UnsupportedArmorSkills,
  ...WeaponSkills,
  ...ArmorSkills
};

// src/vendor/calculator/attacks/bow.ts
var BowAttacks = [
  {
    name: "Charged Shot Lv1",
    mv: 9,
    eleMul: 0.2,
    rawMul: 1.1,
    charge: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Charged Shot Lv2",
    mv: 10,
    eleMul: 0.35,
    rawMul: 1.1,
    hits: 2,
    charge: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Charged Shot Lv3",
    mv: 11,
    eleMul: 0.5,
    hits: 3,
    rawMul: 1.1,
    charge: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Quick Shot",
    mv: 9,
    eleMul: 0.3,
    hits: 3,
    rawMul: 1.1,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Power Shot Lv 1",
    mv: 9,
    eleMul: 0.3,
    hits: 3,
    rawMul: 1.1,
    spreadPowerShot: true,
    rawType: "Shot",
    charge: true
  },
  {
    name: "Power Shot Lv2",
    mv: 10,
    eleMul: 0.5,
    hits: 4,
    rawMul: 1.1,
    spreadPowerShot: true,
    rawType: "Shot",
    charge: true
  },
  {
    name: "Power Shot Lv3",
    mv: 11,
    eleMul: 0.6,
    hits: 5,
    rawMul: 1.1,
    spreadPowerShot: true,
    rawType: "Shot",
    charge: true
  },
  {
    name: "Flying Swallow Shot Lv1",
    mv: 9,
    eleMul: 0.3,
    hits: 3,
    rawMul: 1.1,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Flying Swallow Shot Lv2",
    mv: 10,
    eleMul: 0.5,
    hits: 4,
    rawMul: 1.1,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Flying Swallow Shot Lv3",
    mv: 11,
    eleMul: 0.6,
    hits: 5,
    rawMul: 1.1,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Power Volley Lv1",
    mv: 12,
    eleMul: 0.45,
    hits: 4,
    rawMul: 1.1,
    spreadPowerShot: true,
    rawType: "Shot",
    charge: true
  },
  {
    name: "Power Volley Lv2",
    mv: 13,
    eleMul: 0.65,
    hits: 5,
    rawMul: 1.1,
    spreadPowerShot: true,
    rawType: "Shot",
    charge: true
  },
  {
    name: "Power Volley Lv3",
    mv: 14,
    eleMul: 0.75,
    hits: 6,
    rawMul: 1.1,
    spreadPowerShot: true,
    rawType: "Shot",
    charge: true
  },
  {
    name: "Arc Shot Lv1",
    mv: 8,
    eleMul: 0,
    ignoreCoating: true,
    rawType: "Shot"
  },
  {
    name: "Arc Shot Lv2",
    mv: 9,
    eleMul: 0,
    ignoreCoating: true,
    rawType: "Shot"
  },
  {
    name: "Arc Shot Lv3",
    mv: 10,
    eleMul: 0,
    ignoreCoating: true,
    rawType: "Shot"
  },
  {
    name: "Arc Shot Explosion",
    mv: 12,
    eleMul: 0,
    ignoreCoating: true,
    rawType: "Shot"
  },
  {
    name: "Dragon Piercer",
    mv: 23,
    eleMul: 0.3,
    rawMul: 1.1,
    specialAmmo: true,
    piercingShot: true,
    rawType: "Shot"
  },
  {
    name: "Dragon Piercer (Fast)",
    mv: 16,
    eleMul: 0.3,
    rawMul: 1.1,
    specialAmmo: true,
    piercingShot: true,
    rawType: "Shot"
  },
  {
    name: "Thousand Dragons",
    mv: 23,
    eleMul: 0.3,
    hits: 6,
    rawMul: 1.1,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Charge Shot Lv1",
    mv: 3,
    eleMul: 0.1,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Charge Shot Lv2",
    mv: 4,
    eleMul: 0.15,
    hits: 2,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Charge Shot Lv3",
    mv: 5,
    eleMul: 0.2,
    hits: 3,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Quick Shot",
    mv: 3,
    eleMul: 0.1,
    hits: 3,
    rawMul: 1.1,
    ignoreCoating: true,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Power Shot Lv1",
    mv: 3,
    eleMul: 0.1,
    hits: 3,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Power Shot Lv2",
    mv: 4,
    eleMul: 0.15,
    hits: 4,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Power Shot Lv3",
    mv: 5,
    eleMul: 0.2,
    hits: 5,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Flying Swallow Shot Lv1",
    mv: 3,
    eleMul: 0.1,
    hits: 3,
    rawMul: 1.1,
    ignoreCoating: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Flying Swallow Shot Lv2",
    mv: 4,
    eleMul: 0.15,
    hits: 4,
    rawMul: 1.1,
    ignoreCoating: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Flying Swallow Shot Lv3",
    mv: 5,
    eleMul: 0.2,
    hits: 5,
    rawMul: 1.1,
    ignoreCoating: true,
    normalShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Power Volley Lv1",
    mv: 4,
    eleMul: 0.15,
    hits: 4,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Power Volley Lv2",
    mv: 5,
    eleMul: 0.2,
    hits: 5,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Power Volley Lv3",
    mv: 6,
    eleMul: 0.25,
    hits: 6,
    rawMul: 1.1,
    charge: true,
    ignoreCoating: true,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Pierce Thousand Dragons",
    mv: 11,
    eleMul: 0.3,
    rawMul: 1.1,
    ignoreCoating: true,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Arrow",
    mv: 25,
    eleMul: 1,
    ignoreCoating: true,
    specialAmmo: true,
    rawType: "Shot"
  },
  // { name: "Tracer Arrow (Explosion)", mv: 25 },
  {
    name: "Tracer Charged Shot",
    mv: 12,
    eleMul: 0.5,
    hits: 3,
    charge: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Charged Shot (Miss)",
    mv: 6,
    eleMul: 0.5,
    hits: 3,
    rawType: "Shot"
  },
  {
    name: "Tracer Quick Shot",
    mv: 12,
    eleMul: 0.6,
    hits: 3,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Power Shot",
    mv: 12,
    eleMul: 0.6,
    hits: 5,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Power Volley",
    mv: 15,
    eleMul: 0.65,
    hits: 6,
    spreadPowerShot: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Dragon Piercer",
    mv: 27,
    eleMul: 0.3,
    specialAmmo: true,
    piercingShot: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Dragon Piercer (Fast)",
    mv: 19,
    eleMul: 0.3,
    specialAmmo: true,
    piercingShot: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Thousand Dragons",
    mv: 26,
    eleMul: 0.3,
    hits: 6,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Tracer Pierce Thousand Dragons",
    mv: 14,
    eleMul: 0.3,
    hits: 6,
    ignoreCoating: true,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Focus Fire: Hailstorm",
    mv: 12,
    eleMul: 0.3,
    ignoreCoating: true,
    rawType: "Shot"
  },
  {
    name: "Focus Fire: Hailstorm Dragon Piercer",
    mv: 20,
    eleMul: 0.3,
    ignoreCoating: true,
    rawType: "Shot"
  }
];

// src/vendor/calculator/attacks/chargeBlade.ts
var ChargeBladeAttacks = [
  { name: "Sword: Forward Slash", mv: 18 },
  { name: "Sword: Weak Slash", mv: 15 },
  { name: "Sword: Return Stroke", mv: 18 },
  { name: "Sword: Roundslash", mv: 30 },
  { name: "Sword: Fade Slash", mv: 24 },
  { name: "Sword: Charged Rising Slash", mv: 15 },
  { name: "Sword: Charged Double Slash 1", mv: 25, charge: true },
  { name: "Sword: Charged Double Slash 2", mv: 16, charge: true },
  { name: "Sword: Shield Thrust 1", mv: 15 },
  { name: "Sword: Shield Thrust 2", mv: 6 },
  { name: "Sword: Condensed Elemental Slash", mv: 48 },
  {
    name: "Sword: Condensed Elemental Slash Impact Phial",
    mv: 25,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Sword: Condensed Elemental Slash Element Phial",
    mv: 0,
    eleMul: 4,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Sword: Morph Slash",
    mv: 54,
    cbAxe: true,
    morph: true
  },
  {
    name: "Axe: Rising Slash",
    mv: 38,
    cbAxe: true
  },
  {
    name: "Axe: Overhead Slash",
    mv: 54,
    cbAxe: true
  },
  {
    name: "Axe: Dash Slam",
    mv: 48,
    cbAxe: true
  },
  {
    name: "Axe: Lateral Fade Slash / Backstep Slash",
    mv: 42,
    cbAxe: true
  },
  {
    name: "Axe: Morph Slash / Elemental Roundslash",
    mv: 30,
    morph: true
  },
  {
    name: "Axe: Elemental Discharge I",
    mv: 53,
    cbAxe: true
  },
  {
    name: "Axe: Elemental Discharge II 1",
    mv: 35,
    cbAxe: true
  },
  {
    name: "Axe: Elemental Discharge II 2",
    mv: 58,
    cbAxe: true
  },
  {
    name: "Axe: Amped Elemental Discharge",
    mv: 68,
    cbAxe: true
  },
  {
    name: "Axe: Amped Elemental Discharge Follow-up",
    mv: 78,
    cbAxe: true
  },
  {
    name: "Axe: Super Amped Elemental Discharge 1",
    mv: 16,
    cbAxe: true
  },
  {
    name: "Axe: Super Amped Elemental Discharge 2",
    mv: 78,
    cbAxe: true
  },
  {
    name: "Axe: Super Amped Elemental Discharge 3",
    mv: 45,
    cbAxe: true
  },
  {
    name: "Savage Axe Slash",
    mv: 48,
    cbAxe: true
  },
  {
    name: "Power Axe Tick",
    mv: 12,
    eleMul: 0.2,
    cbAxe: true
  },
  {
    name: "Impact Phial (Sword)",
    mv: 5,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Impact Phial (ED)",
    mv: 12,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Overcharged Impact Phial (ED)",
    mv: 14,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Impact Phial (AED)",
    mv: 16,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Overcharged Impact Phial (AED)",
    mv: 20,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Impact Phial (SAED)",
    mv: 28,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Overcharged Impact Phial (SAED)",
    mv: 30,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    ignoreHzv: true,
    cbPhial: true,
    artilleryAmmo: true
  },
  {
    name: "Element Phial (Sword)",
    mv: 0,
    eleMul: 1.5,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Element Phial (ED)",
    mv: 0,
    eleMul: 2,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Overcharged Element Phial (ED)",
    mv: 0,
    eleMul: 2.2,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Element Phial (AED)",
    mv: 0,
    eleMul: 4,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Overcharged Element Phial (AED)",
    mv: 0,
    eleMul: 5,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Element Phial (SAED)",
    mv: 0,
    eleMul: 8,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Overcharged Element Phial (SAED)",
    mv: 0,
    eleMul: 10,
    cantCrit: true,
    ignoreSharpness: true,
    cbPhial: true
  },
  {
    name: "Focus Slash: Double Rend",
    mv: 15
  },
  {
    name: "Focus Strike Savage Axe",
    mv: 50,
    cbAxe: true
  },
  {
    name: "Focus Strike Savage Axe Ticks",
    mv: 6,
    eleMul: 0.3,
    cbAxe: true
  },
  {
    name: "Sword Jumping Slash / Axe Jumping Morph Slash",
    mv: 22
  },
  {
    name: "Axe Jumping Slash / Sword Jumping Morph Slash",
    mv: 46,
    cbAxe: true
  }
];

// src/vendor/calculator/attacks/dualBlades.ts
var DualBladesAttacks = [
  { name: "Double Slash 1", mv: 8, eleMul: 0.6 },
  { name: "Double Slash 2", mv: 11, eleMul: 0.6 },
  { name: "Double Slash Return Stroke", mv: 11, hits: 2, eleMul: 0.6 },
  { name: "Circle Slash 1", mv: 6, eleMul: 0.7 },
  { name: "Circle Slash 2", mv: 11, eleMul: 0.7 },
  { name: "Circle Slash 3", mv: 12, eleMul: 0.7 },
  { name: "Demon Fangs", mv: 14, eleMul: 0.6 },
  { name: "Twofold Demon Slash 1", mv: 15, eleMul: 0.6 },
  { name: "Twofold Demon Slash 2", mv: 7, eleMul: 0.6 },
  { name: "Sixfold Demon Slash 1", mv: 13, hits: 2, eleMul: 0.6 },
  { name: "Sixfold Demon Slash 2", mv: 9, hits: 2, eleMul: 0.6 },
  { name: "Sixfold Demon Slash 3", mv: 18, hits: 2, eleMul: 0.6 },
  { name: "Fade Slash", mv: 10, eleMul: 0.6 },
  { name: "Rising Slash", mv: 8, eleMul: 0.6 },
  { name: "Demon Rising Slash", mv: 10, eleMul: 0.8 },
  { name: "Lunging Strike 1-2", mv: 3, eleMul: 0.6 },
  { name: "Lunging Strike 3-4", mv: 6, eleMul: 0.6 },
  { name: "Side/Back Lunging Strike", hits: 2, mv: 6, eleMul: 0.6 },
  { name: "Demon Flurry Rush 1", mv: 5, hits: 2, eleMul: 0.6 },
  { name: "Demon Flurry Rush 2", mv: 4, hits: 2, eleMul: 0.6 },
  { name: "Demon Flurry Rush 3", mv: 11, hits: 2 },
  { name: "Left Spinning Slash 1", mv: 14, eleMul: 0.6 },
  { name: "Left Spinning Slash 2", mv: 6, eleMul: 0.6 },
  { name: "Left Spinning Slash 3", mv: 5, eleMul: 0.6 },
  { name: "Right Spinning Slash 1", mv: 15 },
  { name: "Right Spinning Slash 2", mv: 7, eleMul: 0.6 },
  { name: "Right Spinning Slash 3", mv: 5, eleMul: 0.6 },
  { name: "Left Double Roundslash 1", mv: 16 },
  { name: "Left Double Roundslash 2", mv: 6, eleMul: 0.6 },
  { name: "Left Double Roundslash 3", mv: 5 },
  { name: "Right Double Roundslash 1", mv: 16 },
  { name: "Right Double Roundslash 2", mv: 8 },
  { name: "Right Double Roundslash 3", mv: 5 },
  { name: "Blade Dance I 1", mv: 18, hits: 2 },
  { name: "Blade Dance I 2", mv: 6, hits: 2, eleMul: 0.6 },
  { name: "Blade Dance I 3", mv: 10, hits: 2, eleMul: 0.6 },
  { name: "Blade Dance I 4", mv: 4, hits: 2, eleMul: 0.8 },
  { name: "Blade Dance I 5", mv: 20, hits: 2, eleMul: 0.8 },
  { name: "Blade Dance I 6", mv: 11, hits: 2, eleMul: 0.8 },
  { name: "Blade Dance II 1", mv: 16, hits: 2, eleMul: 0.6 },
  { name: "Blade Dance II 2", mv: 6, eleMul: 0.8 },
  { name: "Blade Dance II 3", mv: 25, eleMul: 0.8 },
  { name: "Blade Dance III 1", mv: 22, eleMul: 0.6 },
  { name: "Blade Dance III 2", mv: 8, eleMul: 0.6 },
  { name: "Blade Dance III 3", mv: 5, eleMul: 0.6 },
  { name: "Blade Dance III 4", mv: 18, eleMul: 0.8 },
  { name: "Blade Dance III 5", mv: 5, eleMul: 0.8 },
  { name: "Blade Dance III 6", mv: 14, eleMul: 0.8 },
  { name: "Blade Dance III 7", mv: 18, eleMul: 0.8 },
  { name: "Blade Dance III 8", mv: 22, eleMul: 0.6 },
  { name: "Blade Dance III 9", mv: 8, eleMul: 0.8 },
  { name: "Blade Dance III 10", mv: 36, hits: 2, eleMul: 0.8 },
  { name: "Demon Flurry I", mv: 15, hits: 4 },
  { name: "Demon Flurry II 1", mv: 8, eleMul: 0.6 },
  { name: "Demon Flurry II 2", mv: 6, eleMul: 0.6 },
  { name: "Demon Flurry II 3", mv: 18, hits: 2 },
  { name: "Jumping Doubleslash 1", mv: 12, eleMul: 0.6 },
  { name: "Jumping Doubleslash 2", mv: 9, eleMul: 0.6 },
  { name: "Midair Spinning Blade Dance 1", mv: 12, eleMul: 0.5 },
  { name: "Midair Spinning Blade Dance 2", mv: 8, eleMul: 0.5 },
  { name: "Midair Spinning Blade Dance 3", mv: 12, eleMul: 0.7 },
  { name: "Midair Spinning Blade Dance 4", mv: 8, eleMul: 0.7 },
  {
    name: "Midair Spinning Blade Dance Finisher 1",
    mv: 15,
    eleMul: 0.7,
    hits: 2
  },
  {
    name: "Midair Spinning Blade Dance Finisher 2",
    mv: 20,
    eleMul: 0.8,
    hits: 2
  },
  {
    name: "Midair Spinning Blade Dance Finisher 3",
    mv: 6,
    eleMul: 0.8,
    hits: 2
  },
  { name: "Heavenly Blade Dance 1", mv: 15, eleMul: 0.4 },
  { name: "Heavenly Blade Dance 2", mv: 10, eleMul: 0.4 },
  { name: "Heavenly Blade Dance 3", mv: 12, eleMul: 0.4 },
  { name: "Heavenly Blade Dance 4", mv: 8, eleMul: 0.4 },
  { name: "Heavenly Blade Dance Finisher 1", mv: 20, hits: 2 },
  { name: "Heavenly Blade Dance Finisher 2", mv: 24, hits: 2, eleMul: 0.7 },
  { name: "Heavenly Blade Dance Finisher 3", mv: 8, hits: 2, eleMul: 0.7 },
  { name: "Sliding Slash 1", mv: 10, hits: 2, eleMul: 0.6 },
  { name: "Sliding Slash 2", mv: 13, hits: 2, eleMul: 0.6 },
  { name: "Perfect Evade 1", mv: 6, hits: 2, eleMul: 0.3 },
  { name: "Perfect Evade 2", mv: 10, hits: 2, eleMul: 0.6 },
  { name: "Screw Slicer 1", mv: 2, eleMul: 0.8 },
  { name: "Screw Slicer 2", mv: 3, eleMul: 0.8 },
  { name: "Screw Slicer 3", mv: 10, hits: 2 },
  { name: "Screw Slicer 4", mv: 15, hits: 2 },
  { name: "Focus Strike: Turning Tide", mv: 10 },
  { name: "Focus Strike: Turning Tide Follow-Up", mv: 27 },
  { name: "Turning Tidedrill 1", mv: 12, eleMul: 0.6 },
  { name: "Turning Tidedrill 2", mv: 9, eleMul: 0.6, hits: 2 },
  { name: "Turning Tidedrill 3", mv: 12, eleMul: 0.6 },
  { name: "Turning Tidedrill 4", mv: 9, eleMul: 0.6 },
  { name: "Turning Tidedrill 5", mv: 12, eleMul: 0.6, hits: 2 },
  { name: "Turning Tidedrill 6", mv: 9, eleMul: 0.6 },
  { name: "Turning Tidedrill 7", mv: 18, eleMul: 0.7 },
  { name: "Turning Tidedrill 8", mv: 24, eleMul: 0.7 }
];

// src/vendor/calculator/attacks/greatSword.ts
var GreatSwordAttacks = [
  { name: "Overhead Slash", mv: 81 },
  { name: "Charged Slash Lv1", mv: 106, eleMul: 1.1, charge: true },
  { name: "Charged Slash Lv2", mv: 135, eleMul: 1.2, charge: true },
  { name: "Charged Slash Lv3", mv: 168, eleMul: 1.3, charge: true },
  { name: "Wide Slash", mv: 42 },
  { name: "Rising Slash", mv: 38 },
  { name: "Offset Rising Slash Lv1", mv: 96, eleMul: 1.1, charge: true },
  { name: "Offset Rising Slash Lv2", mv: 123, eleMul: 1.2, charge: true },
  { name: "Offset Rising Slash Lv3", mv: 154, eleMul: 1.3, charge: true },
  { name: "Follow-up Cross Slash Lv1 1", mv: 44, charge: true },
  { name: "Follow-up Cross Slash Lv1 2", mv: 180, charge: true },
  { name: "Follow-up Cross Slash Lv2 1", mv: 49, charge: true },
  { name: "Follow-up Cross Slash Lv2 2", mv: 200, charge: true },
  { name: "Follow-up Cross Slash Lv3 1", mv: 58, charge: true },
  { name: "Follow-up Cross Slash Lv3 2", mv: 230, charge: true },
  { name: "Kick", mv: 5, eleMul: 0, ignoreSharpness: true, ignoreHzv: true },
  { name: "Side Blow", mv: 16, rawType: "Blunt" },
  { name: "Strong Charged Slash Lv1", mv: 111, eleMul: 1.3, charge: true },
  { name: "Strong Charged Slash Lv2", mv: 144, eleMul: 1.4, charge: true },
  { name: "Strong Charged Slash Lv3", mv: 181, eleMul: 1.5, charge: true },
  { name: "Strong Wide Slash Lv1", mv: 90, eleMul: 1.7, charge: true },
  { name: "Strong Wide Slash Lv2", mv: 106, eleMul: 2, charge: true },
  { name: "Strong Wide Slash Lv3", mv: 124, eleMul: 2.2, charge: true },
  {
    name: "Tackle",
    mv: 23,
    eleMul: 0,
    rawMul: 1.05,
    ignoreSharpness: true,
    rawType: "Blunt"
  },
  {
    name: "Tackle Lv1",
    mv: 26,
    eleMul: 0,
    rawMul: 1.05,
    ignoreSharpness: true,
    rawType: "Blunt"
  },
  {
    name: "Tackle Lv2",
    mv: 35,
    eleMul: 0,
    rawMul: 1.05,
    ignoreSharpness: true,
    rawType: "Blunt"
  },
  {
    name: "Tackle Lv3",
    mv: 48,
    eleMul: 0,
    rawMul: 1.05,
    ignoreSharpness: true,
    rawType: "Blunt"
  },
  { name: "Leaping Wide Slash", mv: 93 },
  { name: "Leaping Wide Slash Lv1", mv: 111, eleMul: 2, charge: true },
  { name: "Leaping Wide Slash Lv2", mv: 135, eleMul: 2.5, charge: true },
  { name: "Leaping Wide Slash Lv3", mv: 167, eleMul: 3.1, charge: true },
  { name: "True Charged Slash Lv1 1", mv: 12, charge: true },
  { name: "True Charged Slash Lv1 2", mv: 105, eleMul: 1.5, charge: true },
  {
    name: "True Charged Slash Lv1 2 (Power)",
    mv: 125,
    eleMul: 1.5,
    charge: true
  },
  { name: "True Charged Slash Lv2 1", mv: 14, charge: true },
  { name: "True Charged Slash Lv2 2", mv: 153, eleMul: 1.8, charge: true },
  {
    name: "True Charged Slash Lv2 2 (Power)",
    mv: 186,
    eleMul: 1.8,
    charge: true
  },
  { name: "True Charged Slash Lv3 1", mv: 16, charge: true },
  { name: "True Charged Slash Lv3 2", mv: 195, eleMul: 2, charge: true },
  {
    name: "True Charged Slash Lv3 2 (Power)",
    mv: 248,
    eleMul: 2,
    charge: true
  },
  { name: "Focus Slash: Perforate", mv: 15, eleMul: 0.4 },
  { name: "Jumping Charged Slash", mv: 50, airborne: true },
  {
    name: "Jumping Charged Slash Lv1",
    mv: 60,
    eleMul: 1.1,
    charge: true,
    airborne: true
  },
  {
    name: "Jumping Charged Slash Lv2",
    mv: 71,
    eleMul: 1.2,
    charge: true,
    airborne: true
  },
  {
    name: "Jumping Charged Slash Lv3",
    mv: 90,
    eleMul: 1.3,
    charge: true,
    airborne: true
  },
  // { name: "Clash Finisher", mv: 90 },
  { name: "Plunging Thrust", mv: 36, eleMul: 0.4, airborne: true }
  // { name: "Plunging Thrust Lv1", mv: 42, eleMul: 0.4 },
  // { name: "Plunging Thrust Lv2", mv: 50, eleMul: 0.4 },
  // { name: "Plunging Thrust Lv3", mv: 58, eleMul: 0.4 },
  // { name: "Scaling Drop Slash 1", mv: 20 },
  // { name: "Scaling Drop Slash 2", mv: 45 },
  // { name: "Seikret Attack I", mv: 15 },
  // { name: "Seikret Attack II", mv: 10 },
  // { name: "Dismount Attack 1", mv: 20 },
  // // { name: "Dismount Attack 2", mv: 50 },
  // { name: "Focus Slash: Perforate Lv1", mv: 20, eleMul: 0.4 },
  // { name: "Focus Slash: Perforate Lv2", mv: 26, eleMul: 0.4 },
  // { name: "Focus Slash: Perforate Lv3", mv: 33, eleMul: 0.4 },
  // { name: "Focus Slash: Perforate Lv0 Extra Hit", mv: 14, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv1 Extra Hit", mv: 16, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv2 Extra Hit", mv: 18, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv3 Extra Hit", mv: 24, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv0 Multihit", mv: 10, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv1 Multihit", mv: 11, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv2 Multihit", mv: 12, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv3 Multihit", mv: 13, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv0 Finisher 1", mv: 15, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv1 Finisher 1", mv: 20, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv2 Finisher 1", mv: 22, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Lv3 Finisher 1", mv: 24, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Finisher 2", mv: 6, eleMul: 0.1 },
  // { name: "Focus Slash: Perforate Finisher 3", mv: 2, eleMul: 0.1 },
  // { name: "Aerial Focus Strike Lv0", mv: 15, eleMul: 0.4 },
  // { name: "Aerial Focus Strike Lv1", mv: 20, eleMul: 0.4 },
  // { name: "Aerial Focus Strike Lv2", mv: 26, eleMul: 0.4 },
  // { name: "Aerial Focus Strike Lv3", mv: 33, eleMul: 0.4 },
  // { name: "Aerial Focus Strike Extra Hit Lv0", mv: 14, eleMul: 0.1 },
  // { name: "Aerial Focus Strike Extra Hit Lv1", mv: 16, eleMul: 0.1 },
  // { name: "Aerial Focus Strike Extra Hit Lv2", mv: 18, eleMul: 0.1 },
  // { name: "Aerial Focus Strike Extra Hit Lv3", mv: 24, eleMul: 0.1 },
];

// src/vendor/calculator/attacks/gunlance.ts
var CHARGED_SHELL_MUL = 1.8;
var MULTI_WSE_MUL = 1.1;
var FB_MUL = {
  Normal: 1.4,
  Long: 1.4,
  Wide: 1.35
};
var WSFB_MUL = {
  Normal: 1.25,
  Long: 1.1,
  Wide: 1.05
};
var Shelling = {
  Normal: {
    1: {
      shell: { mv: 7, fixedEle: 6 },
      wyvernFire: { mv: 39, fixedEle: 22 },
      wyrmstake: { mv: 23, fixedEle: 19 }
    },
    2: {
      shell: { mv: 8, fixedEle: 7 },
      wyvernFire: { mv: 43, fixedEle: 24 },
      wyrmstake: { mv: 25, fixedEle: 21 }
    },
    3: {
      shell: { mv: 9, fixedEle: 8 },
      wyvernFire: { mv: 47, fixedEle: 26 },
      wyrmstake: { mv: 28, fixedEle: 23 }
    },
    4: {
      // PLACEHOLDER, NOT IN-GAME YET
      shell: { mv: 10, fixedEle: 9 },
      wyvernFire: { mv: 52, fixedEle: 29 },
      wyrmstake: { mv: 31, fixedEle: 25 }
    }
  },
  Long: {
    1: {
      shell: { mv: 10, fixedEle: 14 },
      wyvernFire: { mv: 39, fixedEle: 22 },
      wyrmstake: { mv: 32, fixedEle: 19 }
    },
    2: {
      shell: { mv: 11, fixedEle: 15 },
      wyvernFire: { mv: 43, fixedEle: 24 },
      wyrmstake: { mv: 37, fixedEle: 21 }
    },
    3: {
      shell: { mv: 12, fixedEle: 16 },
      wyvernFire: { mv: 47, fixedEle: 26 },
      wyrmstake: { mv: 42, fixedEle: 23 }
    },
    4: {
      shell: { mv: 13, fixedEle: 17 },
      wyvernFire: { mv: 52, fixedEle: 29 },
      wyrmstake: { mv: 49, fixedEle: 25 }
    }
  },
  Wide: {
    1: {
      shell: { mv: 17, fixedEle: 9 },
      wyvernFire: { mv: 46, fixedEle: 24 },
      wyrmstake: { mv: 23, fixedEle: 19 }
    },
    2: {
      shell: { mv: 19, fixedEle: 10 },
      wyvernFire: { mv: 50, fixedEle: 26 },
      wyrmstake: { mv: 25, fixedEle: 21 }
    },
    3: {
      shell: { mv: 21, fixedEle: 11 },
      wyvernFire: { mv: 55, fixedEle: 29 },
      wyrmstake: { mv: 27, fixedEle: 23 }
    },
    4: {
      shell: { mv: 23, fixedEle: 12 },
      wyvernFire: { mv: 60, fixedEle: 32 },
      wyrmstake: { mv: 30, fixedEle: 25 }
    }
  }
};
var s = {
  elementType: "Fire",
  ignoreSharpness: true,
  ignoreHzv: true,
  cantCrit: true
};
var shell = (name, type, level, mvMul = 1) => ({
  ...s,
  name: `${type} Lv${level} ${name}`,
  mv: round(Shelling[type][level].shell.mv * mvMul, 4),
  fixedEle: round(Shelling[type][level].shell.fixedEle, 4),
  shelling: { type, level }
});
var wyvernFire = (type, level) => ({
  ...s,
  ...Shelling[type][level].wyvernFire,
  name: `${type} Lv${level} Wyvern Fire 1`,
  shelling: { type, level }
});
var wyvernFireTwo = (type, level) => ({
  ...wyvernFire(type, level),
  name: `${type} Lv${level} Wyvern Fire 2`,
  hits: 4,
  eleHzvCap: 5
});
var wst = (type, level) => ({
  name: `${type} Lv${level} Wyrmstake Ticks`,
  mv: (type === "Long" ? 5 : 4) + level,
  eleMul: 0.5,
  ignoreSharpness: true,
  shelling: { level, type }
});
var wse = (type, level) => ({
  ...s,
  ...Shelling[type][level].wyrmstake,
  name: `${type} Lv${level} Wyrmstake Explosion`,
  shelling: { type, level }
});
var mswe = (type, level) => ({
  ...s,
  mv: round(Shelling[type][level].wyrmstake.mv * MULTI_WSE_MUL, 4),
  fixedEle: round(Shelling[type][level].wyrmstake.fixedEle * MULTI_WSE_MUL, 4),
  name: `${type} Lv${level} Multi Wyrmstake Explosion`,
  shelling: { type, level }
});
var GunlanceAttacks = [
  { name: "Lateral Thrust I / II", mv: 24, eleMul: 2 },
  { name: "Lunging Upthrust", mv: 38, eleMul: 1.2 },
  { name: "Rising Slash", mv: 38, eleMul: 1.2 },
  { name: "Guard Thrust", mv: 18, eleMul: 2 },
  { name: "Overhead Smash", mv: 57, eleMul: 2 },
  {
    name: "Wide Sweep / Moving Wide Sweep / Aerial Burst",
    mv: 40,
    eleMul: 1.5
  },
  { name: "(Multi) Wyrmstake Full Blast Sweep", mv: 30 },
  { name: "Wyrmstake Thrust", mv: 40, eleMul: 2 },
  { name: "Wyrmstake Full Blast Thrust", mv: 20 },
  { name: "Wyrmstake Attach", mv: 20, eleMul: 2 },
  { name: "Jumping Thrust", mv: 25 },
  { name: "Jumping Smash", mv: 44 },
  { name: "Jumping Rising Slash", mv: 35 },
  { name: "Focus Strike: Drake Auger", mv: 18 },
  {
    name: "Focus Strike: Drake Auger Ticks",
    mv: 7,
    eleMul: 0.5,
    shelling: { level: 0 }
  },
  ...ShellingTypes.flatMap((type) => {
    return [1, 2, 3, 4].flatMap((level) => [
      wst(type, level),
      shell("Shell", type, level, 1),
      shell("Charged Shell", type, level, CHARGED_SHELL_MUL),
      shell("Full Burst Shell", type, level, FB_MUL[type]),
      shell("Wyrmstake Full Burst Shell", type, level, WSFB_MUL[type]),
      wse(type, level),
      mswe(type, level),
      wyvernFire(type, level),
      wyvernFireTwo(type, level)
    ]);
  })
];

// src/vendor/calculator/attacks/hammer.ts
var b = { eleMul: 1.5, rawType: "Blunt" };
var HammerAttacks = [
  { ...b, name: "Swing", mv: 22 },
  { ...b, name: "Follow-up", mv: 18 },
  { ...b, name: "Overhead Smash I", mv: 41 },
  { ...b, name: "Overhead Smash II", mv: 45 },
  { ...b, name: "Upswing", mv: 95, eleMul: 1.95 },
  { ...b, name: "Side Smash", mv: 23, eleMul: 1.65 },
  { ...b, name: "Big Bang I", mv: 43, eleMul: 1.65 },
  { ...b, name: "Big Bang II", mv: 48, eleMul: 1.65 },
  { ...b, name: "Big Bang III", mv: 70, eleMul: 1.65 },
  { ...b, name: "Big Bang IV", mv: 90, eleMul: 1.65 },
  { ...b, name: "Big Bang Finisher 1", mv: 28, hits: 2, eleMul: 1.65 },
  { ...b, name: "Big Bang Finisher 2", mv: 130, eleMul: 2.25 },
  { ...b, name: "Charged Side Blow", mv: 25, charge: true, eleMul: 16.5 },
  { ...b, name: "Charged Follow-up", mv: 55 },
  { ...b, name: "Charged Upswing", mv: 70, charge: true, eleMul: 1.8 },
  { ...b, name: "Charged Big Bang 1", mv: 20, charge: true },
  { ...b, name: "Charged Big Bang 2", mv: 130, charge: true, eleMul: 2.25 },
  { ...b, name: "Spinning Bludgeon Start", mv: 23, eleMul: 3.75 },
  { ...b, name: "Spinning Bludgeon Mid", mv: 18, eleMul: 3.75 },
  { ...b, name: "Spinning Bludgeon Finish", mv: 25, eleMul: 2.25 },
  { ...b, name: "Spinning Side Smash", mv: 30, eleMul: 2.25 },
  { ...b, name: "Spinning Follow-up", mv: 55, eleMul: 2.25 },
  { ...b, name: "Spinning Strong Upswing", mv: 100, eleMul: 2.25 },
  { ...b, name: "Mighty Charge Upswing", mv: 130, charge: true, eleMul: 1.8 },
  { ...b, name: "Mighty Charge Slam 1", mv: 20, charge: true },
  { ...b, name: "Mighty Charge Slam 2", mv: 20, charge: true, eleMul: 1.8 },
  { ...b, name: "Mighty Charge Slam 3", mv: 200, charge: true, eleMul: 2.25 },
  { ...b, name: "Follow-Up Spinslam Spin", mv: 20 },
  { ...b, name: "Follow-Up Spinslam 1", mv: 20 },
  { ...b, name: "Follow-Up Spinslam 2", mv: 210, eleMul: 2.25 },
  { ...b, name: "Focus Blow: Earthquake", mv: 15 },
  { ...b, name: "Focus Blow: Earthquake Spin", mv: 30 },
  { ...b, name: "Focus Blow: Earthquake Finisher", mv: 45 },
  { ...b, name: "Jumping Smash", mv: 37 },
  {
    ...b,
    name: "Jumping Charged Attack I",
    mv: 72,
    charge: true,
    eleMul: 1.65
  },
  {
    ...b,
    name: "Jumping Charged Attack II",
    mv: 77,
    charge: true,
    eleMul: 1.8
  },
  {
    ...b,
    name: "Jumping Charged Attack III",
    mv: 88,
    charge: true,
    eleMul: 2.25
  }
];

// src/vendor/calculator/attacks/ammo.ts
var ELE_1_MV = 8;
var ELE_2_MV = 10;
var ELE_1_RAW_ELE = 20;
var ELE_2_RAW_ELE = 25;
var normal = (level, mv) => ({
  name: `Normal Lv${level}`,
  mv,
  normalShot: true,
  rawType: "Shot",
  ammo: { type: "Normal", level }
});
var Ammo = {
  Normal: {
    1: normal(1, 17),
    2: normal(2, 23.8),
    3: normal(3, 32.3)
  },
  Pierce: {
    1: {
      name: "Pierce Lv1",
      mv: 11,
      piercingShot: true,
      rawType: "Shot",
      ammo: { type: "Pierce", level: 1 }
    },
    2: {
      name: "Pierce Lv2",
      mv: 12,
      piercingShot: true,
      rawType: "Shot",
      ammo: { type: "Pierce", level: 2 }
    },
    3: {
      name: "Pierce Lv3",
      mv: 12,
      piercingShot: true,
      rawType: "Shot",
      ammo: { type: "Pierce", level: 3 }
    }
  },
  Spread: {
    1: {
      name: "Spread Lv1",
      mv: 13,
      spreadPowerShot: true,
      rawType: "Shot",
      ammo: { type: "Spread", level: 1 }
    },
    2: {
      name: "Spread Lv2",
      mv: 15.6,
      spreadPowerShot: true,
      rawType: "Shot",
      ammo: { type: "Spread", level: 2 }
    },
    3: {
      name: "Spread Lv3",
      mv: 18.2,
      spreadPowerShot: true,
      rawType: "Shot",
      ammo: { type: "Spread", level: 3 }
    }
  },
  Slicing: {
    1: { name: "Slicing", mv: 33, ammo: { type: "Slicing", level: 1 } }
  },
  Sticky: {
    1: {
      name: "Sticky Lv1",
      mv: 30,
      fixedEle: 5,
      elementType: "Fire",
      cantCrit: true,
      ignoreHzv: true,
      artilleryAmmo: true,
      ammo: { type: "Sticky", level: 1 }
    },
    2: {
      name: "Sticky Lv2",
      mv: 38.4,
      fixedEle: 5,
      elementType: "Fire",
      cantCrit: true,
      ignoreHzv: true,
      artilleryAmmo: true,
      ammo: { type: "Sticky", level: 2 }
    },
    3: {
      name: "Sticky Lv3",
      mv: 48,
      fixedEle: 5,
      elementType: "Fire",
      cantCrit: true,
      ignoreHzv: true,
      artilleryAmmo: true,
      ammo: { type: "Sticky", level: 3 }
    }
  },
  Cluster: {
    1: {
      name: "Cluster Lv1",
      mv: 23,
      fixedEle: 5,
      elementType: "Fire",
      cantCrit: true,
      ignoreHzv: true,
      ammo: { type: "Cluster", level: 1 }
    },
    2: {
      name: "Cluster Lv2",
      mv: 27.5,
      fixedEle: 5,
      elementType: "Fire",
      cantCrit: true,
      ignoreHzv: true,
      ammo: { type: "Cluster", level: 2 }
    },
    3: {
      name: "Cluster Lv3",
      mv: 32.2,
      fixedEle: 5,
      elementType: "Fire",
      cantCrit: true,
      ignoreHzv: true,
      ammo: { type: "Cluster", level: 3 }
    }
  },
  Wyvern: {
    1: {
      name: "Wyvern Lv1",
      mv: 80,
      fixedEle: 20,
      elementType: "Fire",
      cantCrit: true,
      ignoreHzv: true,
      artilleryAmmo: true,
      ammo: { type: "Wyvern", level: 1 }
    }
  },
  Flaming: {
    1: {
      name: "Flaming Lv1",
      mv: ELE_1_MV,
      rawEle: ELE_1_RAW_ELE,
      elementType: "Fire",
      rawType: "Shot",
      ammo: { type: "Flaming", level: 1 }
    },
    2: {
      name: "Flaming Lv2",
      mv: ELE_2_MV,
      rawEle: ELE_2_RAW_ELE,
      elementType: "Fire",
      rawType: "Shot",
      ammo: { type: "Flaming", level: 2 }
    }
  },
  Water: {
    1: {
      name: "Water Lv1",
      mv: ELE_1_MV,
      rawEle: ELE_1_RAW_ELE,
      elementType: "Water",
      rawType: "Shot",
      ammo: { type: "Water", level: 1 }
    },
    2: {
      name: "Water Lv2",
      mv: ELE_2_MV,
      rawEle: ELE_2_RAW_ELE,
      elementType: "Water",
      rawType: "Shot",
      ammo: { type: "Water", level: 2 }
    }
  },
  Freeze: {
    1: {
      name: "Freeze Lv1",
      mv: ELE_1_MV,
      rawEle: ELE_1_RAW_ELE,
      elementType: "Ice",
      rawType: "Shot",
      ammo: { type: "Freeze", level: 1 }
    },
    2: {
      name: "Freeze Lv2",
      mv: ELE_2_MV,
      rawEle: ELE_2_RAW_ELE,
      elementType: "Ice",
      rawType: "Shot",
      ammo: { type: "Freeze", level: 2 }
    }
  },
  Thunder: {
    1: {
      name: "Thunder Lv1",
      mv: ELE_1_MV,
      rawEle: ELE_1_RAW_ELE,
      elementType: "Thunder",
      rawType: "Shot",
      ammo: { type: "Thunder", level: 1 }
    },
    2: {
      name: "Thunder Lv2",
      mv: ELE_2_MV,
      rawEle: ELE_2_RAW_ELE,
      elementType: "Thunder",
      rawType: "Shot",
      ammo: { type: "Thunder", level: 2 }
    }
  },
  Dragon: {
    1: {
      name: "Dragon Lv1",
      mv: 20,
      rawEle: 44,
      elementType: "Dragon",
      rawType: "Shot",
      ammo: { type: "Dragon", level: 1 }
    }
  }
};

// src/vendor/calculator/attacks/heavyBowgun.ts
var WH_MUL = 1.2;
var WH_MUL_2 = Math.pow(WH_MUL, 2);
var WH_MUL_3 = Math.pow(WH_MUL, 3);
var WH_MUL_MAX = Math.pow(WH_MUL, 4);
var HeavyBowgunAttacks = [
  ...Object.values(Ammo).flatMap((m) => Object.values(m)),
  { name: "Wyvernheart Lv1 1", mv: 9.9, specialAmmo: true, rawType: "Shot" },
  {
    name: "Wyvernheart Lv1 2",
    mv: 9.9,
    rawMul: WH_MUL_2,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Wyvernheart Lv1 3",
    mv: 9.9,
    rawMul: WH_MUL_3,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Wyvernheart Lv1 Max",
    mv: 9.9,
    rawMul: WH_MUL_MAX,
    specialAmmo: true,
    rawType: "Shot"
  },
  { name: "Wyvernheart Lv2 1", mv: 10.8, specialAmmo: true, rawType: "Shot" },
  {
    name: "Wyvernheart Lv2 2",
    mv: 10.8,
    rawMul: WH_MUL_2,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Wyvernheart Lv2 3",
    mv: 10.8,
    rawMul: WH_MUL_3,
    specialAmmo: true,
    rawType: "Shot"
  },
  {
    name: "Wyvernheart Lv2 Max",
    mv: 10.8,
    rawMul: WH_MUL_MAX,
    specialAmmo: true,
    rawType: "Shot"
  }
  // {
  //   name: "Wyvernpiercer Lv 2",
  //   mv: 7.85,
  //   specialAmmo: true,
  // },
];

// src/vendor/calculator/attacks/huntingHorn.ts
var HuntingHornAttacks = [
  { name: "Forward Smash", mv: 32, rawType: "Blunt" },
  { name: "Left Swing", mv: 33, rawType: "Blunt" },
  { name: "Right Swing", mv: 33, rawType: "Blunt" },
  { name: "Flourish 1", mv: 15, rawType: "Blunt" },
  { name: "Flourish 2", mv: 25, rawType: "Blunt" },
  { name: "Backwards Strike", mv: 46, rawType: "Blunt" },
  { name: "Overhead Smash 1", mv: 14, rawType: "Blunt" },
  { name: "Overhead Smash 2", mv: 42, rawType: "Blunt" },
  { name: "Overhead Smash Follow-up Attack", mv: 65, rawType: "Blunt" },
  { name: "Hilt Stab", mv: 10 },
  { name: "Neutral / Forward Perform", mv: 35, rawType: "Blunt" },
  { name: "Side Perform", mv: 45, rawType: "Blunt" },
  { name: "Back Perform", mv: 60, rawType: "Blunt" },
  { name: "Performance Beat I", mv: 29, rawType: "Blunt" },
  { name: "Performance Beat I (Power)", mv: 35, rawType: "Blunt" },
  { name: "Performance Beat II", mv: 31, rawType: "Blunt" },
  { name: "Performance Beat II (Power)", mv: 45, rawType: "Blunt" },
  { name: "Encore 1", mv: 20, rawType: "Blunt" },
  { name: "Encore 2", mv: 60, rawType: "Blunt" },
  { name: "Encore 2 (Power)", mv: 75, rawType: "Blunt" },
  { name: "Offset Melody", mv: 75, melody: true, rawType: "Blunt" },
  { name: "Resounding Melody 1", mv: 20, melody: true, rawType: "Blunt" },
  { name: "Resounding Melody 2", mv: 22, melody: true, rawType: "Blunt" },
  { name: "Resounding Melody 3", mv: 20, melody: true, rawType: "Blunt" },
  {
    name: "Resounding Melody Soundwaves",
    rawType: "Blunt",
    mv: 15,
    eleMul: 0.5,
    ignoreSharpness: true,
    cantCrit: true,
    melody: true
  },
  {
    name: "Perform Soundwave",
    rawType: "Blunt",
    mv: 27,
    ignoreSharpness: true,
    cantCrit: true
  },
  {
    name: "Song Soundwave",
    rawType: "Blunt",
    mv: 10,
    ignoreSharpness: true,
    cantCrit: true
  },
  {
    name: "Echo Bubble",
    rawType: "Blunt",
    mv: 45,
    eleMul: 0.3,
    ignoreHzv: true,
    cantCrit: true,
    ignoreSharpness: true
  },
  {
    name: "Echo Bubble (Note)",
    rawType: "Blunt",
    mv: 5,
    eleMul: 0.3,
    ignoreHzv: true,
    cantCrit: true,
    ignoreSharpness: true
  },
  {
    name: "Echo Bubble (Song)",
    rawType: "Blunt",
    mv: 12,
    eleMul: 0.3,
    ignoreHzv: true,
    cantCrit: true,
    ignoreSharpness: true
  },
  {
    name: "Echo Wave (Blunt)",
    rawType: "Blunt",
    mv: 50,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Blunt) II",
    rawType: "Blunt",
    mv: 70,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Blunt) III",
    rawType: "Blunt",
    mv: 100,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Slash)",
    mv: 50,
    eleMul: 0,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Slash) II",
    mv: 70,
    eleMul: 0,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Slash) III",
    mv: 100,
    eleMul: 0,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Fire)",
    rawType: "Blunt",
    mv: 45,
    fixedEle: 60,
    elementType: "Fire",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Fire) II",
    rawType: "Blunt",
    mv: 65,
    fixedEle: 100,
    elementType: "Fire",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Fire) III",
    rawType: "Blunt",
    mv: 85,
    fixedEle: 140,
    elementType: "Fire",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Water)",
    rawType: "Blunt",
    mv: 45,
    fixedEle: 60,
    elementType: "Water",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Water) II",
    rawType: "Blunt",
    mv: 65,
    fixedEle: 100,
    elementType: "Water",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Water) III",
    rawType: "Blunt",
    mv: 85,
    fixedEle: 140,
    elementType: "Water",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Thunder)",
    rawType: "Blunt",
    mv: 45,
    fixedEle: 60,
    elementType: "Thunder",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Thunder) II",
    rawType: "Blunt",
    mv: 65,
    fixedEle: 100,
    elementType: "Thunder",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Thunder) III",
    rawType: "Blunt",
    mv: 85,
    fixedEle: 140,
    elementType: "Thunder",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Ice)",
    rawType: "Blunt",
    mv: 45,
    fixedEle: 60,
    elementType: "Ice",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Ice) II",
    rawType: "Blunt",
    mv: 65,
    fixedEle: 100,
    elementType: "Ice",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Ice) III",
    rawType: "Blunt",
    mv: 85,
    fixedEle: 140,
    elementType: "Ice",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Dragon)",
    rawType: "Blunt",
    mv: 45,
    fixedEle: 60,
    elementType: "Dragon",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Dragon) II",
    rawType: "Blunt",
    mv: 65,
    fixedEle: 100,
    elementType: "Dragon",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Dragon) III",
    rawType: "Blunt",
    mv: 85,
    fixedEle: 140,
    elementType: "Dragon",
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Blast)",
    rawType: "Blunt",
    mv: 45,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Blast) II",
    rawType: "Blunt",
    mv: 65,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Blast) III",
    rawType: "Blunt",
    mv: 85,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Paralysis)",
    rawType: "Blunt",
    mv: 45,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Paralysis) II",
    rawType: "Blunt",
    mv: 65,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Paralysis) III",
    rawType: "Blunt",
    mv: 85,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Poison)",
    rawType: "Blunt",
    mv: 45,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Poison) II",
    rawType: "Blunt",
    mv: 65,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Poison) III",
    rawType: "Blunt",
    mv: 85,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Sleep)",
    rawType: "Blunt",
    mv: 45,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Sleep) II",
    rawType: "Blunt",
    mv: 65,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  },
  {
    name: "Echo Wave (Sleep) III",
    rawType: "Blunt",
    mv: 85,
    eleMul: 0,
    cantCrit: true,
    ignoreSharpness: true,
    melody: true
  }
];

// src/vendor/calculator/attacks/insectGlaive.ts
var InsectGlaiveAttacks = [
  { name: "Rising Slash Combo 1", mv: 20, eleMul: 0.7 },
  { name: "Rising Slash Combo 2", mv: 14, eleMul: 0.8 },
  { name: "Reaping Slash", mv: 18, eleMul: 0.8 },
  { name: "Double Slash 1", mv: 18, eleMul: 0.7 },
  { name: "Double Slash 2", mv: 24, eleMul: 0.8 },
  { name: "Sidestep Slash", mv: 24, eleMul: 0.8 },
  { name: "Sidestep Slash Combo 1", mv: 14, eleMul: 0.8 },
  { name: "Sidestep Slash Combo 2", mv: 28, eleMul: 0.8 },
  { name: "Sidestep Slash Combo 1 (Forward)", mv: 14, eleMul: 0.8 },
  { name: "Sidestep Slash Combo 2 (Forward)", mv: 28, eleMul: 0.8 },
  { name: "Wide Sweep", mv: 22, eleMul: 0.8 },
  { name: "Leaping Slash", mv: 28, eleMul: 0.8, airborne: true },
  { name: "Overhead Smash", mv: 26, eleMul: 0.8 },
  { name: "Dodge Slash", mv: 20, eleMul: 0.8, airborne: true },
  { name: "Strong Rising Slash Combo 1", mv: 24, eleMul: 0.8 },
  { name: "Strong Rising Slash Combo 2", mv: 12, eleMul: 0.8 },
  { name: "Strong Rising Slash Combo 3", mv: 24, eleMul: 0.8 },
  { name: "Strong Reaping Slash 1", mv: 18, eleMul: 0.8 },
  { name: "Strong Reaping Slash 2", mv: 28, eleMul: 0.8 },
  { name: "Strong Double Slash 1", mv: 26, eleMul: 0.8 },
  { name: "Strong Double Slash 2", mv: 18, eleMul: 0.8 },
  { name: "Strong Double Slash 3", mv: 40 },
  { name: "Strong Wide Sweep 1", mv: 12, eleMul: 0.8 },
  { name: "Strong Wide Sweep 2", mv: 24, eleMul: 0.8 },
  { name: "Tornado Slash 1", mv: 22 },
  { name: "Tornado Slash 2", mv: 48 },
  { name: "Jumping Slash", mv: 18, eleMul: 1, airborne: true },
  { name: "Jumping Advancing Slash", mv: 26, eleMul: 0.8, airborne: true },
  { name: "Strong Jumping Slash", mv: 14, eleMul: 0.6, airborne: true },
  {
    name: "Strong Jumping Advancing Slash 1",
    mv: 8,
    eleMul: 0.5,
    airborne: true,
    hits: 4
  },
  {
    name: "Strong Jumping Advancing Slash 2",
    mv: 28,
    eleMul: 0.8,
    airborne: true
  },
  {
    name: "Strong Jumping Advancing Slash II 1",
    mv: 8.8,
    eleMul: 0.5,
    airborne: true,
    hits: 4
  },
  {
    name: "Strong Jumping Advancing Slash II 2",
    mv: 30.8,
    eleMul: 0.8,
    airborne: true
  },
  {
    name: "Strong Jumping Advancing Slash III 1",
    mv: 10.4,
    eleMul: 0.5,
    airborne: true,
    hits: 4
  },
  {
    name: "Strong Jumping Advancing Slash III 2",
    mv: 36.4,
    eleMul: 0.8,
    airborne: true
  },
  { name: "Scaling Double Slash 1", mv: 12, eleMul: 0.8 },
  { name: "Scaling Double Slash 2", mv: 20, eleMul: 0.8 },
  { name: "Descending Slash Lv1 1", mv: 15, charge: true, airborne: true },
  { name: "Descending Slash Lv1 2", mv: 9, charge: true, airborne: true },
  { name: "Descending Slash Lv1 3", mv: 12, charge: true, airborne: true },
  { name: "Descending Slash Lv1 4", mv: 24, charge: true },
  { name: "Descending Slash Lv2 1", mv: 20, charge: true, airborne: true },
  { name: "Descending Slash Lv2 2", mv: 12, charge: true, airborne: true },
  { name: "Descending Slash Lv2 3", mv: 16, charge: true, airborne: true },
  { name: "Descending Slash Lv2 4", mv: 32, charge: true },
  {
    name: "Strong Descending Slash Lv1 1",
    mv: 24,
    charge: true,
    airborne: true
  },
  {
    name: "Strong Descending Slash Lv1 2",
    mv: 9,
    charge: true,
    airborne: true
  },
  {
    name: "Strong Descending Slash Lv1 3-5",
    mv: 13.5,
    charge: true,
    airborne: true
  },
  {
    name: "Strong Descending Slash Lv1 6",
    mv: 34.5,
    charge: true
  },
  {
    name: "Strong Descending Slash Lv2 1",
    mv: 32,
    charge: true,
    airborne: true
  },
  {
    name: "Strong Descending Slash Lv2 2",
    mv: 12,
    charge: true,
    airborne: true
  },
  {
    name: "Strong Descending Slash Lv2 3-5",
    mv: 18,
    charge: true,
    airborne: true
  },
  {
    name: "Strong Descending Slash Lv2 6",
    mv: 46,
    charge: true
  },
  { name: "Descending Thrust Lv1 1", mv: 21, charge: true, airborne: true },
  {
    name: "Descending Thrust Lv1 2",
    mv: 3.75,
    eleMul: 0,
    rawType: "Blunt",
    charge: true
  },
  { name: "Descending Thrust Lv1 3", mv: 18, charge: true },
  { name: "Descending Thrust Lv2 1", mv: 28, charge: true, airborne: true },
  {
    name: "Descending Thrust Lv2 2",
    mv: 5,
    eleMul: 0,
    rawType: "Blunt",
    charge: true
  },
  { name: "Descending Thrust Lv2 3", mv: 24, charge: true },
  {
    name: "Strong Descending Thrust Lv1 1",
    mv: 21,
    charge: true,
    airborne: true
  },
  {
    name: "Strong Descending Thrust Lv1 2",
    mv: 7.5,
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv1 3",
    mv: 3.75,
    eleMul: 0,
    rawType: "Blunt",
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv1 4-5",
    mv: 13,
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv1 6",
    mv: 21,
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv2 1",
    mv: 28,
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv2 2",
    mv: 10,
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv2 3",
    mv: 5,
    eleMul: 0,
    rawType: "Blunt",
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv2 4-5",
    mv: 18,
    charge: true
  },
  {
    name: "Strong Descending Thrust Lv2 6",
    mv: 28,
    charge: true
  },
  {
    name: "Rising Spiral Slash Lv1",
    mv: 48,
    eleMul: 0.8,
    hits: 5,
    airborne: true,
    noExtract: true
  },
  {
    name: "Rising Spiral Slash Lv2",
    mv: 64,
    eleMul: 0.8,
    hits: 5,
    airborne: true,
    noExtract: true
  },
  { name: "Kinsect Mark (Melee)", mv: 5, eleMul: 0, rawType: "Blunt" },
  {
    name: "Focus Thrust: Leaping Strike 1",
    mv: 16,
    airborne: true
  },
  {
    name: "Focus Thrust: Leaping Strike 2",
    mv: 18,
    airborne: true
  },
  {
    name: "Focus Thrust: Leaping Strike 3",
    mv: 8,
    airborne: true
  }
];

// src/vendor/calculator/attacks/lance.ts
var LanceAttacks = [
  { name: "Mid Thrust I / II", mv: 24, eleMul: 1.2 },
  { name: "Mid Thrust III", mv: 33, eleMul: 1.4 },
  { name: "High Thrust I / II", mv: 31 },
  { name: "High Thrust III", mv: 40 },
  { name: "Triple Thrust 1 / 2", mv: 22, eleMul: 1.2 },
  { name: "Triple Thrust 3", mv: 35, eleMul: 1.4 },
  { name: "Charge Counter", mv: 43 },
  { name: "Charge Counter Lv1", mv: 51.6, charge: true },
  { name: "Charge Counter Lv2", mv: 60.2, charge: true },
  { name: "Charge Counter Lv3", mv: 73.1, charge: true },
  { name: "Double Counter-thrust 1", mv: 25 },
  { name: "Double Counter-thrust 2", mv: 50 },
  { name: "Double Counter-thrust Lv1 1", mv: 30, charge: true },
  { name: "Double Counter-thrust Lv1 2", mv: 60, charge: true },
  { name: "Double Counter-thrust Lv2 1", mv: 35, charge: true },
  { name: "Double Counter-thrust Lv2 2", mv: 70, charge: true },
  { name: "Double Counter-thrust Lv3 1", mv: 42.5, charge: true },
  { name: "Double Counter-thrust Lv3 2", mv: 85, charge: true },
  { name: "Leaping Thrust", mv: 29, hits: 2, eleMul: 1.2, airborne: true },
  { name: "Wide Sweep", mv: 80, eleMul: 1.4 },
  { name: "Shield Attack", mv: 20, eleMul: 0, rawType: "Blunt" },
  { name: "Guard Thrust", mv: 20 },
  { name: "Dash Attack", mv: 17, eleMul: 0.5 },
  { name: "Finishing Thrust", mv: 55, eleMul: 1.4 },
  { name: "Finishing Twin Thrust 1", mv: 35, eleMul: 1.6 },
  { name: "Finishing Twin Thrust 2", mv: 60, eleMul: 1.6 },
  { name: "Reverse Attack", mv: 53, eleMul: 1.4 },
  { name: "Advancing Jump", mv: 25, eleMul: 0.5 },
  { name: "Reverse Attack (High Speed)", mv: 80, eleMul: 1.4 },
  { name: "Advancing Jump Thrust", mv: 30, eleMul: 0.5 },
  { name: "Advancing Jump Thrust (High Speed)", mv: 33, eleMul: 0.5 },
  { name: "Jumping Thrust", mv: 30 },
  { name: "Guard Counter", mv: 20, eleMul: 0, rawType: "Blunt" },
  { name: "Perfect Guard Counter", mv: 25, eleMul: 0, rawType: "Blunt" },
  { name: "Return Thrust", mv: 24, eleMul: 1.2 },
  { name: "Return Thrust (Power)", mv: 31, eleMul: 1.4 },
  { name: "Payback Thrust 1", mv: 30 },
  { name: "Payback Thrust 1 (Power)", mv: 42, eleMul: 1.4 },
  { name: "Payback Thrust 2", mv: 25 },
  { name: "Retribution Thrust 1", mv: 30, eleMul: 1.4 },
  { name: "Retribution Thrust 1 (Power)", mv: 58, eleMul: 1.6 },
  { name: "Retribution Thrust 2", mv: 15 },
  { name: "Grand Retribution Thrust 1", mv: 50 },
  { name: "Grand Retribution Thrust 2", mv: 20 },
  { name: "Grand Retribution Thrust 3", mv: 12 },
  { name: "Follow-up Dash Attack", mv: 17, eleMul: 0.5 },
  { name: "Focus Strike: Victory Thrust 1", mv: 20, eleMul: 0 },
  { name: "Focus Strike: Victory Thrust 2", mv: 15 },
  { name: "Focus Strike: Victory Thrust 3", mv: 55 },
  { name: "Power Clash Finisher 1", mv: 60, eleMul: 0 },
  { name: "Power Clash Finisher 2", mv: 120 }
];

// src/vendor/calculator/attacks/lightBowgun.ts
var ELE_MV_MUL = 0.68;
var MV_MUL = {
  Normal: 0.65,
  Pierce: 0.8,
  Spread: 0.7,
  Sticky: 0.5,
  Flaming: ELE_MV_MUL,
  Water: ELE_MV_MUL,
  Freeze: ELE_MV_MUL,
  Thunder: ELE_MV_MUL,
  Dragon: 0.7,
  Slicing: 0.8,
  // no LBG
  Wyvern: 0,
  Cluster: 0
};
var C_ELE_MV_MUL = 0.75;
var C_MV_MUL = {
  Normal: 1.3,
  Pierce: 1.2,
  Spread: 0.85,
  Sticky: 1,
  Flaming: C_ELE_MV_MUL,
  Water: C_ELE_MV_MUL,
  Freeze: C_ELE_MV_MUL,
  Thunder: C_ELE_MV_MUL,
  Dragon: 1.1,
  // 1.2 for Element
  Slicing: 1,
  // no LBG
  Wyvern: 0,
  Cluster: 0
};
var RF_ELE_MV_MUL = 0.58;
var RF_MV_MUL = {
  Normal: 0.5,
  Pierce: 0.65,
  Spread: 0.6,
  Sticky: 0.35,
  Flaming: RF_ELE_MV_MUL,
  Water: RF_ELE_MV_MUL,
  Freeze: RF_ELE_MV_MUL,
  Thunder: RF_ELE_MV_MUL,
  Dragon: 0.65,
  Slicing: 0.55,
  // no LBG
  Wyvern: 0,
  Cluster: 0
};
var RF_C_ELE_MV_MUL = 0.986;
var RF_C_MV_MUL = {
  Normal: 1.5,
  Pierce: 1.95,
  Spread: 0.935,
  Sticky: 0.87,
  Flaming: RF_C_ELE_MV_MUL,
  Water: RF_C_ELE_MV_MUL,
  Freeze: RF_C_ELE_MV_MUL,
  Thunder: RF_C_ELE_MV_MUL,
  Dragon: 1.5,
  // 1.4 for Element
  Slicing: 1,
  // no LBG
  Wyvern: 0,
  Cluster: 0
};
var AmmoLBG = produce(Ammo, (d) => void (d.Normal[3].mv = 30.6));
var LightBowgunAttacks = [
  ...Object.values(AmmoLBG).flatMap((m) => Object.values(m)).filter((a) => a.ammo?.type !== "Cluster" && a.ammo?.type !== "Wyvern").map((a) => [
    produce(a, (d) => {
      d.mv = round(d.mv * MV_MUL[d.ammo.type], 5);
      if (d.rawEle) d.rawEle = round(d.rawEle * MV_MUL[d.ammo.type], 5);
    }),
    produce(a, (d) => {
      d.name = `${d.name} Chaser`;
      d.mv = round(d.mv * C_MV_MUL[d.ammo.type], 5);
      if (d.rawEle) {
        if (d.elementType === "Dragon") d.rawEle = round(d.rawEle * 1.2, 5);
        else d.rawEle = round(d.rawEle * C_MV_MUL[d.ammo.type], 5);
      }
    }),
    produce(a, (d) => {
      d.name = `Rapid ${d.name}`;
      d.mv = round(d.mv * RF_MV_MUL[d.ammo.type], 5);
      if (d.rawEle) d.rawEle = round(d.rawEle * RF_MV_MUL[d.ammo.type], 5);
    }),
    produce(a, (d) => {
      d.name = `Rapid ${d.name} Chaser`;
      d.mv = round(d.mv * RF_C_MV_MUL[d.ammo.type], 5);
      if (d.rawEle) {
        if (d.elementType === "Dragon") d.rawEle = round(d.rawEle * 1.4, 5);
        else d.rawEle = round(d.rawEle * RF_C_MV_MUL[d.ammo.type], 5);
      }
    })
  ]).flat()
];

// src/vendor/calculator/attacks/longSword.ts
var LongSwordAttacks = [
  { name: "Overhead Slash I", mv: 24 },
  { name: "Overhead Slash II", mv: 18 },
  { name: "Crescent Slash", mv: 32 },
  { name: "Crimson Slash I 1", mv: 33, eleMul: 0.5 },
  { name: "Crimson Slash I 2", mv: 16, eleMul: 0.5 },
  { name: "Crimson Slash II 1", mv: 11, eleMul: 1.05 },
  { name: "Crimson Slash II 2", mv: 22, eleMul: 1.05 },
  { name: "Crimson Slash III 1", mv: 30, eleMul: 1.1 },
  { name: "Crimson Slash III 2", mv: 18, eleMul: 1.1 },
  { name: "Crimson Slash III 3", mv: 55, eleMul: 1.1 },
  { name: "Thrust", mv: 18 },
  { name: "Rising Slash", mv: 18 },
  { name: "Fade Slash", mv: 22 },
  { name: "Spirit Blade I", mv: 31 },
  { name: "Spirit Blade I (No Gauge)", mv: 14 },
  { name: "Directional Spirit Blade I 1", mv: 31 },
  { name: "Directional Spirit Blade I 1 (No Gauge)", mv: 14 },
  { name: "Spirit Blade II", mv: 30 },
  { name: "Spirit Blade II (No Gauge)", mv: 14 },
  { name: "Directional Spirit Blade II 1", mv: 14 },
  { name: "Directional Spirit Blade II 2", mv: 26 },
  { name: "Directional Spirit Blade II 1 (No Gauge)", mv: 8 },
  { name: "Directional Spirit Blade II 2 (No Gauge)", mv: 18 },
  { name: "Spirit Blade III 1", mv: 14 },
  { name: "Spirit Blade III 2", mv: 19 },
  { name: "Spirit Blade III 3", mv: 34 },
  { name: "Spirit Blade III 1 (No Gauge)", mv: 8 },
  { name: "Spirit Blade III 2 (No Gauge)", mv: 11 },
  { name: "Spirit Blade III 3 (No Gauge)", mv: 19 },
  { name: "Spirit Roundslash", mv: 38 },
  { name: "Spirit Roundslash (Red)", mv: 42 },
  { name: "Spirit Roundslash (No Gauge)", mv: 19 },
  { name: "Spinning Crimson Slash", mv: 60 },
  { name: "Spirit Step Slash", mv: 28 },
  { name: "Spirit Step Slash (No Gauge)", mv: 18 },
  { name: "Jumping Slash", mv: 26 },
  { name: "Jumping Spirit Blade I", mv: 30 },
  { name: "Jumping Spirit Blade I (No Gauge)", mv: 16 },
  { name: "Jumping Spirit Blade II 1", mv: 12 },
  { name: "Jumping Spirit Blade II 2", mv: 26 },
  { name: "Jumping Spirit Blade II 1 (No Gauge)", mv: 8 },
  { name: "Jumping Spirit Blade II 2 (No Gauge)", mv: 15 },
  { name: "Jumping Spirit Blade III 1", mv: 12 },
  { name: "Jumping Spirit Blade III 2", mv: 22 },
  { name: "Jumping Spirit Blade III 3 (Not Used?)", mv: 24 },
  { name: "Jumping Spirit Blade III 3 (No Gauge)", mv: 13 },
  { name: "Jumping Rising Slash", mv: 20 },
  { name: "Aerial Draw Spirit Blade", mv: 48 },
  { name: "Aerial Draw Spirit Blade (No Gauge)", mv: 26 },
  { name: "Foresight Slash", mv: 18 },
  { name: "Foresight Slash (No Gauge)", mv: 11 },
  { name: "Foresight Slash (Success)", mv: 23.4 },
  { name: "Foresight Whirl Slash 1", mv: 22 },
  { name: "Foresight Whirl Slash 2", mv: 13 },
  { name: "Foresight Whirl Slash 1 (Sucess)", mv: 28.6 },
  { name: "Foresight Whirl Slash 2 (Success)", mv: 16.9 },
  { name: "Iai Slash 1", mv: 18 },
  { name: "Iai Slash 2", mv: 13 },
  { name: "Iai Spirit Slash 1 (None)", mv: 17 },
  { name: "Iai Spirit Slash 1 (White)", mv: 19 },
  { name: "Iai Spirit Slash 2 (White) (Success)", mv: 55 },
  { name: "Iai Spirit Slash 1 (Yellow)", mv: 31 },
  { name: "Iai Spirit Slash 2 (Yellow) (Success)", mv: 72 },
  { name: "Iai Spirit Slash 1 (Red)", mv: 39 },
  { name: "Iai Spirit Slash 2 (Red) (Success)", mv: 86 },
  { name: "Spirit Thrust", mv: 19 },
  { name: "Spirit Helmbreaker (White)", mv: 15, eleMul: 0.2 },
  { name: "Spirit Helmbreaker (Yellow)", mv: 20, eleMul: 0.2 },
  { name: "Spirit Helmbreaker (Red)", mv: 23, eleMul: 0.2 },
  { name: "Spirit Release Slash 1", mv: 5, hits: 2 },
  { name: "Spirit Release Slash 2", mv: 10, eleMul: 0.1, hits: 3 },
  { name: "Spirit Release Slash 3", mv: 15, eleMul: 0.1, hits: 3 },
  { name: "Spirit Release Slash 4", mv: 22, eleMul: 0.1, hits: 3 },
  { name: "Spirit Release Slash 5", mv: 35, eleMul: 0.1, hits: 3 }
];

// src/vendor/calculator/attacks/switchAxe.ts
var SwitchAxeAttacks = [
  { name: "Axe: Overhead Slash", mv: 45, saType: "Axe" },
  { name: "Axe: Side Slash", mv: 23, saType: "Axe" },
  { name: "Axe: Spiral Burst Slash 1", mv: 30, saType: "Axe" },
  { name: "Axe: Spiral Burst Slash 2", mv: 41, saType: "Axe" },
  { name: "Axe: Forward Slash", mv: 35, saType: "Axe" },
  { name: "Axe: Forward Overhead Slash", mv: 45, saType: "Axe" },
  { name: "Axe: Fade Slash", mv: 42, saType: "Axe" },
  { name: "Axe: Offset Rising Slash", mv: 50, saType: "Axe" },
  { name: "Axe: Follow-up Heavy Slam 1", mv: 32, saType: "Axe" },
  { name: "Axe: Follow-up Heavy Slam 2", mv: 90, saType: "Axe" },
  { name: "Axe: Follow-up Morph Slash", mv: 123, saType: "Sword", morph: true },
  {
    name: "Axe: Follow-up Morph Slash Explosion (Power Phial)",
    mv: 120,
    eleMul: 0.35,
    saType: "Sword"
  },
  {
    name: "Axe: Follow-up Morph Slash Explosion (Element Phial)",
    mv: 120,
    eleMul: 0.8,
    saType: "Sword"
  },
  // {
  //   name: "Axe: Follow-up Morph Slash Element Phial Explosion",
  //   mv: 65,
  //   eleMul: 0.45,
  //   saType: "Sword",
  // },
  { name: "Axe: Wild Slash Left", mv: 23, saType: "Axe" },
  { name: "Axe: Wild Slash Right", mv: 21, saType: "Axe" },
  { name: "Axe: Heavy Slam 1", mv: 15, saType: "Axe" },
  { name: "Axe: Heavy Slam 2", mv: 72, saType: "Axe" },
  { name: "Axe: Morph Sweep 1", mv: 20, saType: "Axe", morph: true },
  { name: "Axe: Morph Sweep 2", mv: 70, saType: "Axe", morph: true },
  { name: "Axe: Morph Sweep 3", mv: 35, saType: "Axe", morph: true },
  { name: "Axe: Morph Slash", mv: 33, saType: "Sword", morph: true },
  {
    name: "Axe: Morph Rising Double Slash 1",
    mv: 32,
    saType: "Sword",
    morph: true
  },
  {
    name: "Axe: Morph Rising Double Slash 2",
    mv: 28,
    saType: "Sword",
    morph: true
  },
  { name: "Sword: Overhead Slash", mv: 33, saType: "Sword" },
  { name: "Sword: Left Rising Slash", mv: 42, saType: "Sword" },
  { name: "Sword: Right Rising Slash", mv: 48, saType: "Sword" },
  { name: "Sword: Triple Slash 1", mv: 15, saType: "Sword" },
  { name: "Sword: Double Slash 1 / Triple Slash 2", mv: 22, saType: "Sword" },
  { name: "Sword: Double Slash 2 / Triple Slash 3", mv: 26, saType: "Sword" },
  {
    name: "Sword: Heavenward Flurry 1",
    mv: 24,
    saType: "Sword",
    airborne: true
  },
  {
    name: "Sword: Heavenward Flurry 2",
    mv: 36,
    saType: "Sword",
    airborne: true
  },
  { name: "Sword: Morph Slash", mv: 23, saType: "Axe", morph: true },
  { name: "Sword: Morph Double Slash 1", mv: 30, saType: "Axe", morph: true },
  { name: "Sword: Morph Double Slash 2", mv: 50, saType: "Axe", morph: true },
  {
    name: "Sword: Amped State Phial (Power Phial)",
    mv: 12,
    eleMul: 0.35,
    saType: "Sword"
  },
  {
    name: "Sword: Amped State Phial (Element Phial)",
    mv: 12,
    saType: "Sword"
  },
  // {
  //   name: "Sword: Amped State Element Phial Explosion",
  //   mv: 12,
  //   eleMul: 0.425,
  //   saType: "Sword",
  // },
  { name: "Unbridled Slash", mv: 70, saType: "Sword" },
  {
    name: "Unbridled Slash Explosion (Power Phial)",
    mv: 17,
    eleMul: 0.35,
    saType: "Sword"
  },
  {
    name: "Unbridled Slash Explosion (Element Phial)",
    mv: 17,
    eleMul: 0.8,
    saType: "Sword"
  },
  // {
  //   name: "Unbridled Slash Element Phial Explosion",
  //   mv: 17,
  //   eleMul: 0.45,
  //   saType: "Sword",
  //   hits: 3,
  // },
  { name: "Full Release Slash 1", mv: 50, saType: "Sword" },
  { name: "Full Release Slash 2", mv: 82, saType: "Sword" },
  {
    name: "Full Release Slash Explosion 1 (Power Phial)",
    mv: 20,
    eleMul: 0.35,
    saType: "Sword",
    hits: 3
  },
  {
    name: "Full Release Slash Explosion 1 (Element Phial)",
    mv: 20,
    eleMul: 0.8,
    saType: "Sword",
    hits: 3
  },
  {
    name: "Full Release Slash Explosion 2 (Power Phial)",
    mv: 35,
    eleMul: 0.35,
    saType: "Sword",
    hits: 5
  },
  {
    name: "Full Release Slash Explosion 2 (Element Phial)",
    mv: 35,
    eleMul: 0.8,
    saType: "Sword",
    hits: 5
  },
  { name: "Elemental Discharge", mv: 20, saType: "Sword" },
  { name: "Elemental Discharge Tick", mv: 12, eleMul: 0.7, saType: "Sword" },
  { name: "Elemental Discharge Finisher", mv: 135, saType: "Sword" },
  { name: "Finishing Discharge", mv: 65, saType: "Sword" },
  { name: "Zero Sum Discharge Finisher", mv: 160, saType: "Sword" },
  { name: "Zero Sum Finishing Discharge", mv: 75, saType: "Sword" }
];

// src/vendor/calculator/attacks/swordAndShield.ts
var SwordAndShieldAttacks = [
  { name: "Advancing Slash", mv: 22 },
  { name: "Rising Slash", mv: 18 },
  { name: "Chop", mv: 18, eleMul: 1.3 },
  { name: "Side Slash", mv: 17, eleMul: 1.3 },
  { name: "Diagonal Rising Slash", mv: 24, eleMul: 1.3 },
  { name: "Diagonal Chop", mv: 27, eleMul: 1.3 },
  { name: "Lateral Slash", mv: 27, eleMul: 1.2 },
  { name: "Return Stroke", mv: 28, eleMul: 1.2 },
  { name: "Spinning Rising Slash", mv: 39, eleMul: 1.2 },
  { name: "Roundslash", mv: 41 },
  { name: "Spinning Reaper", mv: 65 },
  { name: "Shield Attack", mv: 16, eleMul: 0, rawType: "Blunt" },
  { name: "Shield Bash", mv: 27, eleMul: 0, rawType: "Blunt" },
  { name: "Hard Basher", mv: 40, eleMul: 0, rawType: "Blunt" },
  { name: "Guard Slash", mv: 14 },
  { name: "Charged Slash", mv: 40, charge: true },
  { name: "Scaling Slash", mv: 25 },
  { name: "Jumping Rising Slash", mv: 18 },
  { name: "Jumping Advancing Slash", mv: 18 },
  { name: "Jumping Slash", mv: 20 },
  { name: "Falling Bash 1", mv: 52, eleMul: 0, rawType: "Blunt" },
  { name: "Falling Bash 2", mv: 47, eleMul: 0, rawType: "Blunt" },
  { name: "Plunging Thrust", mv: 12, eleMul: 0.3 },
  { name: "Sliding Sweep 1", mv: 10 },
  { name: "Sliding Sweep 2", mv: 50 },
  { name: "Sliding Slash 1", mv: 12 },
  { name: "Sliding Slash 2", mv: 30 },
  { name: "Leaping Slash", mv: 30 },
  { name: "Perfect Rush I 1", mv: 10, eleMul: 0, rawType: "Blunt" },
  { name: "Perfect Rush I 2", mv: 15 },
  { name: "Perfect Rush I 3", mv: 15 },
  { name: "Perfect Rush II", mv: 20, eleMul: 0, rawType: "Blunt" },
  { name: "Perfect Rush III", mv: 30 },
  { name: "Perfect Rush III Hits", mv: 18 },
  { name: "Power Perfect Rush I 1", mv: 40, eleMul: 0 },
  { name: "Power Perfect Rush I 2", mv: 40, eleMul: 1.5 },
  { name: "Power Perfect Rush I 3", mv: 45, eleMul: 1.5 },
  { name: "Power Perfect Rush II", mv: 60, eleMul: 0 },
  { name: "Power Perfect Rush III", mv: 80, eleMul: 1.5 },
  { name: "Power Perfect Rush III Hits", mv: 34 },
  { name: "Charged Chop 1", mv: 18, charge: true },
  { name: "Charged Chop 2", mv: 28, eleMul: 1.2, charge: true },
  { name: "Charged Chop 3", mv: 14, eleMul: 0.3, charge: true },
  { name: "Power Charged Chop 3", mv: 28, eleMul: 1.25, charge: true },
  { name: "Counter Slash", mv: 55, eleMul: 1.5 },
  { name: "Recovering Slash", mv: 18 },
  { name: "Focus Strike: Vital Stab", mv: 15 },
  { name: "Focus Strike: Vital Stab (Opening Wound)", mv: 19, eleMul: 0.3 },
  { name: "Falling Slash", mv: 20 },
  { name: "Falling Slash Hits", mv: 7, eleMul: 0.3 },
  { name: "Upswing Bash", mv: 20, eleMul: 0, rawType: "Blunt" },
  { name: "Upswing Bash Hits", mv: 20, eleMul: 0, rawType: "Blunt" }
];

// src/vendor/calculator/attacks/index.ts
var Attacks = {
  Bow: BowAttacks,
  ["Charge Blade"]: ChargeBladeAttacks,
  ["Dual Blades"]: DualBladesAttacks,
  ["Great Sword"]: GreatSwordAttacks,
  Gunlance: GunlanceAttacks,
  Hammer: HammerAttacks,
  ["Heavy Bowgun"]: HeavyBowgunAttacks,
  ["Hunting Horn"]: HuntingHornAttacks,
  ["Insect Glaive"]: InsectGlaiveAttacks,
  Lance: LanceAttacks,
  ["Light Bowgun"]: LightBowgunAttacks,
  ["Long Sword"]: LongSwordAttacks,
  ["Switch Axe"]: SwitchAxeAttacks,
  ["Sword and Shield"]: SwordAndShieldAttacks
};
var attacks_default = Attacks;
export {
  ArmorSkills,
  ArtianElementUpgrade,
  ArtianTypeToGunlanceShellType,
  attacks_default as Attacks,
  Buffs,
  CombinedBuffs,
  FieldBuffs,
  GroupSkills,
  GroupSkillsCombined,
  HuntingHornBuffs,
  OmegaResonanceBuffs,
  SeriesSkills,
  SeriesSkillsCombined,
  SharpnessEle,
  SharpnessRaw,
  Sharpnesses,
  SlickedBladeBuffs,
  UnsupportedArmorSkills,
  UnsupportedGroupSkills,
  UnsupportedSeriesSkills,
  UnsupportedWeaponSkills,
  WeaponArmorSkills,
  WeaponBuffs,
  WeaponSkills,
  WeaponTypes,
  _round,
  calculate,
  calculateAffinity,
  calculateAttack,
  calculateAverage,
  calculateCrit,
  calculateEleHit,
  calculateElement,
  calculateHandicraft,
  calculateHit,
  calculateRawHit,
  calculateStatus,
  dmg,
  getSharpness,
  getSharpnessEle,
  getSharpnessRaw,
  mul,
  round,
  sum
};
