import EventEmitter from 'events';
import Immutable, {Map} from 'immutable';

/**
 * Copyright (c) 2017, Nitrogen Labs, Inc.
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file for terms.
 */

class Flux extends EventEmitter {
  /**
   * Create a new instance of Flux.  Note that the Flux object
   * is a Singleton pattern, so only one should ever exist.
   *
   * @constructor
   * @this {Flux}
   */
  constructor(options = {}) {
    super();

    // Options
    options = Immutable.fromJS(options);

    // Properties
    this._debug = !!options.get('debug', false);
    this._name = 'arkhamjs';
    this._store = this.getSessionData(this._name) || Map();
    this._storeClasses = Map();
    this._useCache = !!options.get('cache', true);
    this._window = window || {};
  }

  off(event, listener) {
    this.removeListener(event, listener);
  }

  /**
   * Dispatches an action to all stores
   *
   * @param {...Objects} actions to dispatch to all the stores
   */
  dispatch(...actions) {
    const list = Immutable.fromJS(actions);

    // Loop through actions
    list.forEach(a => {
      // Require a type
      if(!!a.get('type')) {
        return;
      }

      let {type, ...data} = a.toJS();
      data = Immutable.fromJS(data);
      const oldState = this._store;

      // When an action comes in, it must be completely handled by all stores
      this._storeClasses.forEach(storeClass => {
        const name = storeClass.name;
        const state = this._store.get(name) || Immutable.fromJS(storeClass.initialState()) || Map();
        this._store = this._store.set(name, storeClass.onAction(type, data, state) || state);

        // Save cache in session storage
        if(this._useCache) {
          this.setSessionData(this._name, this._store);
        }

        return storeClass.state = this._store.get(name);
      });

      if(this._debug) {
        const hasChanged = !this._store.equals(oldState);
        const updatedLabel = hasChanged ? 'Changed State' : 'Unchanged State';
        const updatedColor = hasChanged ? '#00d484' : '#959595';

        if(console.group) {
          console.group(`%c FLUX DISPATCH: ${type}`, 'font-weight:700');
          console.log('%c Action: ', 'color: #00C4FF', a.toJS());
          console.log('%c Last State: ', 'color: #959595', oldState.toJS());
          console.log(`%c ${updatedLabel}: `, `color: ${updatedColor}`, this._store.toJS());
          console.groupEnd();
        } else {
          console.log(`FLUX DISPATCH: ${type}`);
          console.log(`Action: ${a.toJS()}`);
          console.log('Last State: ', oldState.toJS());
          console.log(`${updatedLabel}: `, this._store.toJS());
        }
      }

      this.emit(type, data);
    });

    return list;
  }

  /**
   * Gets the current state object
   *
   * @param {string} [name] (optional) The name of the store for just that object, otherwise it will return all store
   *   objects.
   * @param {string} [defaultValue] (optional) A default value to return if null.
   * @returns {Map} the state object
   */
  getStore(name = '', defaultValue) {
    if(Array.isArray(name)) {
      return this._store.getIn(name, defaultValue);
    }
    else if(name !== '') {
      return this._store.get(name, defaultValue);
    } else {
      return this._store || Map();
    }
  }

  /**
   * Registers a new Store with Flux
   *
   * @param {Class} StoreClass A unique name for the Store
   * @returns {Object} the class object
   */
  registerStore(StoreClass) {
    const name = StoreClass.name;

    if(!this._storeClasses.has(name)) {
      // Create store object
      const store = new StoreClass();
      this._storeClasses = this._storeClasses.set(name, store);

      // Get cached data
      const data = this.getSessionData(this._name);
      const cache = this._useCache && Map.isMap(data) ? data : Map();

      // Get default values
      const state = this._store.get(name) || cache.get(name) || Immutable.fromJS(store.initialState()) || Map();
      this._store = this._store.set(name, state);


      // Save cache in session storage
      if(this._useCache) {
        this.setSessionData(this._name, this._store);
      }
    }

    return this._storeClasses.get(name);
  }

  /**
   * De-registers a named store from Flux
   *
   * @param {string} name The name of the store
   */
  deregisterStore(name = '') {
    this._storeClasses = this._storeClasses.delete(name);
    this._store = this._store.delete(name);
  }

  /**
   * Gets a store object that is registered with Flux
   *
   * @param {string} name The name of the store
   * @returns {Store} the store object
   */
  getClass(name = '') {
    return this._storeClasses.get(name);
  }

  /**
   * Saves data to the sessionStore
   *
   * @param {string} key Key to store data
   * @param {string|object|array|Immutable} value Data to store.
   */
  setSessionData(key, value) {
    if(Immutable.Iterable.isIterable(value)) {
      value = value.toJS();
    }

    if(this._window && this._window.sessionStorage) {
      value = JSON.stringify(value);
      this._window.sessionStorage.setItem(key, value);
    }
  }

  /**
   * Gets data from
   *
   * @param {string} key The key for data
   * @returns {Immutable} the data object associated with the key
   */
  getSessionData(key) {
    let value = '';

    if(this._window && this._window.sessionStorage) {
      value = JSON.parse(this._window.sessionStorage.getItem(key) || '""');
    }

    return Immutable.fromJS(value);
  }

  /**
   * Removes a key from sessionStorage
   *
   * @param {string} key Key associated with the data to remove
   */
  delSessionData(key) {
    if(this._window && this._window.sessionStorage) {
      this._window.sessionStorage.removeItem(key);
    }
  }

  /**
   * Saves data to localStore
   *
   * @param {string} key Key to store data
   * @param {string|object|array|Immutable} value Data to store.
   */
  setLocalData(key, value) {
    if(Immutable.Iterable.isIterable(value)) {
      value = value.toJS();
    }

    if(this._window && this._window.localStorage) {
      value = JSON.stringify(value);
      this._window.localStorage.setItem(key, value);
    }
  }

  /**
   * Gets a store that is registered with Flux
   *
   * @param {string} key The key for data
   * @returns {Immutable} the data object associated with the key
   */
  getLocalData(key) {
    let value = '';

    if(this._window && this._window.localStorage) {
      value = JSON.parse(this._window.localStorage.getItem(key) || '""');
    }

    return Immutable.fromJS(value);
  }

  /**
   * Removes a key from localStorage
   *
   * @param {string} key Key associated with the data to remove
   */
  delLocalData(key) {
    if(this._window && this._window.localStorage) {
      this._window.localStorage.removeItem(key);
    }
  }

  /**
   * Enables the console debugger
   *
   * @param {boolean} value Enable or disable the debugger. Default value: true.
   */
  enableDebugger(value = true) {
    this._debug = value;
  }
}

const flux = new Flux((window || {}).arkhamjs);
export default flux;
