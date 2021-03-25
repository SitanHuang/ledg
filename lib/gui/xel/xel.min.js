(function () {
  'use strict';

  // @copyright
  //   © 2016-2017 Jarosław Foksa

  //
  // DOMRect polfyill
  //

  // @doc
  //   https://drafts.fxtf.org/geometry/#DOMRect
  //   https://github.com/chromium/chromium/blob/master/third_party/blink/renderer/core/geometry/dom_rect_read_only.cc
  {
    if (window.DOMRect === undefined) {
      class DOMRect {
        constructor(x, y, width, height) {
          this.x = x;
          this.y = y;
          this.width = width;
          this.height = height;
        }

        static fromRect(otherRect) {
          return new DOMRect(otherRect.x, otherRect.y, otherRect.width, otherRect.height);
        }

        get top() {
          return this.y;
        }

        get left() {
          return this.x;
        }

        get right() {
          return this.x + this.width;
        }

        get bottom() {
          return this.y + this.height;
        }
      }

      window.DOMRect = DOMRect;
    }
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  //
  // ClientRect polyfill
  //

  if (window.ClientRect) {
    if (window.ClientRect.prototype.hasOwnProperty("x") === false) {
      Object.defineProperty(window.ClientRect.prototype, "x", {
        get() {
          return this.left;
        },
        set(value) {
          this.left = value;
        }
      });
    }
    if (window.ClientRect.prototype.hasOwnProperty("y") === false) {
      Object.defineProperty(window.ClientRect.prototype, "y", {
        get() {
          return this.top;
        },
        set(value) {
          this.top = value;
        }
      });
    }
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  //
  // HTML dialog polyfill
  //

  if (window.HTMLDialogElement) {
    let showModal = HTMLDialogElement.prototype.showModal;
    let close = HTMLDialogElement.prototype.close;
    let openDialogs = [];

    HTMLDialogElement.prototype.showModal = function() {
      return new Promise( async (resolve) => {
        if (this.isConnected === false) {
          resolve();
          return;
        }
        if (this._showAnimation) {
          await this._showAnimation.finished;
        }
        if (this._closeAnimation) {
          await this._closeAnimation.finished;
        }

        showModal.apply(this, arguments);

        // Prevent the document from being scrolled when the dialog is open
        {
          let closeListener;

          document.body.style.overflow = "hidden";
          openDialogs.push(this);

          this.addEventListener("close", closeListener = (event) => {
            // Note that "close" event might also dispatched by e.g. <bx-menu> inside the dialog, so we must
            // ensure that the event target is this dialog
            if (event.target === this) {
              this.removeEventListener("close", closeListener);
              openDialogs = openDialogs.filter(dialog => dialog !== this);

              if (openDialogs.length === 0) {
                document.body.style.overflow = null;
              }
            }
          });
        }

        // Focus either the dialog or an element inside the dialog that has "autofocus" attribute
        // https://github.com/whatwg/html/issues/1929#issuecomment-272632190
        {
          let autofocusElement = this.querySelector("[autofocus]");

          if (autofocusElement) {
            autofocusElement.focus();
          }
          else {
            this.focus();
          }
        }

        // Animate the dialog
        {
          if (this.hasAttribute("hidden") === false) {
            let dialogRect = this.getBoundingClientRect();
            let transitionDuration = parseFloat(getComputedStyle(this).getPropertyValue("transition-duration")) * 1000;
            let transitionTimingFunction = getComputedStyle(this).getPropertyValue("transition-timing-function");

            // Animate from left
            if (getComputedStyle(this).left === "0px" && getComputedStyle(this).right !== "0px") {
              this._showAnimation = this.animate(
                { transform: [`translateX(-${dialogRect.right}px)`, "translateX(0px)"]},
                { duration: transitionDuration, easing: transitionTimingFunction }
              );
            }
            // Animate from right
            else if (getComputedStyle(this).right === "0px" && getComputedStyle(this).left !== "0px") {
              this._showAnimation = this.animate(
                { transform: [`translateX(${dialogRect.width}px)`, "translateX(0px)"]},
                { duration: transitionDuration, easing: transitionTimingFunction }
              );
            }
            // Animate from top
            else {
              this._showAnimation = this.animate(
                { transform: [`translateY(-${dialogRect.bottom}px)`, "translateY(0px)"]},
                { duration: transitionDuration, easing: transitionTimingFunction }
              );
            }
          }
        }

        // Do not close the dialog with "Escape" key
        {
          let keyDownListener;
          let documentKeyDownListener;
          let closeListener;

          this.addEventListener("keydown", keyDownListener = (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
            }
          });

          document.addEventListener("keydown", documentKeyDownListener = (event) => {
            if (event.key === "Escape" && event.target === document.body) {
              // Don't close the dialog if focus is outside the dialog
              event.preventDefault();
            }
          });

          this.addEventListener("close", closeListener = (event) => {
            // Note that "close" event might also dispatched by e.g. <bx-menu> inside the dialog, so we must
            // ensure that the event target is this dialog
            if (event.target === this) {
              this.removeEventListener("close", closeListener);
              this.removeEventListener("keydown", keyDownListener);
              document.removeEventListener("keydown", documentKeyDownListener);
            }
          });
        }

        // Close the dialog when backdrop is clicked
        {
          let pointerDownListener;
          let clickListener;
          let closeListener;
          let closeOnClick = true;

          let isPointerInsideDialog = (event) => {
            let dialogRect = this.getBoundingClientRect();

            return (
              event.clientX >= dialogRect.x &&
              event.clientX <= dialogRect.x + dialogRect.width &&
              event.clientY >= dialogRect.y &&
              event.clientY <= dialogRect.y + dialogRect.height
            );
          };

          this.addEventListener("pointerdown", pointerDownListener = (event) => {
            closeOnClick = (isPointerInsideDialog(event) === false);
          });

          this.addEventListener("click", clickListener = (event) => {
            if (
              event.isTrusted === true && // Click event was not triggered by keyboard
              event.defaultPrevented === false &&
              closeOnClick === true &&
              isPointerInsideDialog(event) === false &&
              this.hasAttribute("open") === true
            ) {
              this.close();

              // Provide a custom "userclose" event which is dispatched only when the dialog was closed by user
              // clicking the backdrop. This event is unlike the standard "close" event which is dispatched even when
              // the dialog was closed programmatically.
              this.dispatchEvent(new CustomEvent("userclose"));
            }
          });

          this.addEventListener("close", closeListener = (event) => {
            // Note that "close" event might also dispatched by e.g. <bx-menu> inside the dialog, so we must
            // ensure that the event target is this dialog
            if (event.target === this) {
              this.removeEventListener("pointerdown", pointerDownListener);
              this.removeEventListener("click", clickListener);
              this.removeEventListener("close", closeListener);
            }
          });
        }

        if (this._showAnimation) {
          await this._showAnimation.finished;
          this._showAnimation = null;
        }

        resolve();
      });
    };

    HTMLDialogElement.prototype.close = function() {
      return new Promise( async (resolve) => {
        // Animate the dialog
        {
          if (this._showAnimation) {
            await this._showAnimation.finished;
          }

          if (this._closeAnimation) {
            await this._closeAnimation.finished;
          }

          if (this.hasAttribute("hidden") === false) {
            let dialogRect = this.getBoundingClientRect();
            let transitionDurationString = getComputedStyle(this).getPropertyValue("transition-duration") || "0s";
            let transitionDuration = parseFloat(transitionDurationString) * 1000;
            let transitionTimingFunction = getComputedStyle(this).getPropertyValue("transition-timing-function") || "ease";

            // Animate to left
            if (getComputedStyle(this).left === "0px" && getComputedStyle(this).right !== "0px") {
              this._closeAnimation = this.animate(
                { transform: ["translateX(0px)", `translateX(-${dialogRect.right}px)`]},
                { duration: transitionDuration, easing: transitionTimingFunction }
              );
            }
            // Animate to right
            else if (getComputedStyle(this).right === "0px" && getComputedStyle(this).left !== "0px") {
              this._closeAnimation = this.animate(
                { transform: ["translateX(0px)", `translateX(${dialogRect.width}px)`]},
                { duration: transitionDuration, easing: transitionTimingFunction }
              );
            }
            // Animate to top
            else {
              this._closeAnimation = this.animate(
                { transform: [ "translateY(0px)", `translateY(-${dialogRect.bottom + 50}px)`]},
                { duration: transitionDuration, easing: transitionTimingFunction }
              );
            }

            await this._closeAnimation.finished;
            this._closeAnimation = null;
          }
        }

        if (this.hasAttribute("open")) {
          close.apply(this, arguments);
        }

        resolve();
      });
    };

    Object.defineProperty(HTMLDialogElement.prototype, "open", {
      get() {
        return this.hasAttribute("open");
      },
      set(open) {
      }
    });
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  //
  // Pointer events polyfills
  //

  // Make "click", "dblclick" and "contextmenu" look more like pointer events
  // (https://github.com/w3c/pointerevents/issues/100#issuecomment-23118584)
  {
    if (MouseEvent.prototype.hasOwnProperty("pointerType") === false) {
      Object.defineProperty(MouseEvent.prototype, "pointerType", {
        get() {
          return this.sourceCapabilities.firesTouchEvents ? "touch" : "mouse";
        }
      });
    }
  }

  // Make setPointerCapture also capture the cursor image
  if (Element.prototype.setPointerCapture) {
    let setPointerCapture = Element.prototype.setPointerCapture;

    Element.prototype.setPointerCapture = function(pointerId) {
      setPointerCapture.call(this, pointerId);

      let cursor = getComputedStyle(this).cursor;
      let styleElements = [];

      {
        for (let node = this.parentNode || this.host; node && node !== document; node = node.parentNode || node.host) {
          if (node.nodeType === document.DOCUMENT_FRAGMENT_NODE) {
            let styleElement = document.createElementNS(node.host.namespaceURI, "style");
            styleElement.textContent = `* { cursor: ${cursor} !important; user-select: none !important; }`;
            node.append(styleElement);
            styleElements.push(styleElement);
          }
          else if (node.nodeType === document.DOCUMENT_NODE) {
            let styleElement = document.createElement("style");
            styleElement.textContent = `* { cursor: ${cursor} !important; user-select: none !important; }`;
            node.head.append(styleElement);
            styleElements.push(styleElement);
          }
        }
      }

      let finish = () => {
        window.removeEventListener("pointerup", finish, true);
        this.removeEventListener("lostpointercapture", finish);

        for (let styleElement of styleElements) {
          styleElement.remove();
        }
      };

      window.addEventListener("pointerup", finish, true);
      this.addEventListener("lostpointercapture", finish);
    };
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  //
  // Web Animations API polyfills
  //

  {
    // Animation.prototype.finished is supported by Chromium >= 84, but we override it anyway due to a bug in the
    // native implementation that causes flickering because the promise is resolved too late:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=771977
    Object.defineProperty(Animation.prototype, "finished", {
      get() {
        return new Promise((resolve) => {
          this.playState === "finished" ? resolve() : this.addEventListener("finish", () => resolve(), {once: true});
        });
      }
    });
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  //
  // Node polyfills (http://dom.spec.whatwg.org, https://github.com/whatwg/dom/issues/161)
  //

  if (!Node.prototype.append) {
    Node.prototype.append = function(child) {
      this.appendChild(child);
    };
  }

  if (!Node.prototype.prepend) {
    Node.prototype.prepend = function(child) {
      this.insertBefore(child, this.firstElementChild);
    };
  }

  if (!Node.prototype.before) {
    Node.prototype.before = function(element) {
      this.parentElement.insertBefore(element, this);
    };
  }

  if (!Node.prototype.after) {
    Node.prototype.after  = function(element) {
      this.parentElement.insertBefore(element, this.nextElementSibling);
    };
  }

  if (!Node.prototype.replace) {
    Node.prototype.replace = function(element) {
      this.parentNode.replaceChild(element, this);
    };
  }

  if (!Node.prototype.closest) {
    Node.prototype.closest = function(selector) {
      return this.parentNode ? this.parentNode.closest(selector) : null;
    };
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  //
  // ResizeObserver API polyfill
  // https://github.com/que-etc/resize-observer-polyfill/blob/master/dist/ResizeObserver.js
  //

  (function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.ResizeObserver = factory());
  }(window, (function () {
  /**
   * A collection of shims that provide minimal functionality of the ES6 collections.
   *
   * These implementations are not meant to be used outside of the ResizeObserver
   * modules as they cover only a limited range of use cases.
   */
  /* eslint-disable require-jsdoc, valid-jsdoc */
  var MapShim = (function () {
      if (typeof Map !== 'undefined') {
          return Map;
      }

      /**
       * Returns index in provided array that matches the specified key.
       *
       * @param {Array<Array>} arr
       * @param {*} key
       * @returns {number}
       */
      function getIndex(arr, key) {
          var result = -1;

          arr.some(function (entry, index) {
              if (entry[0] === key) {
                  result = index;

                  return true;
              }

              return false;
          });

          return result;
      }

      return (function () {
          function anonymous() {
              this.__entries__ = [];
          }

          var prototypeAccessors = { size: { configurable: true } };

          /**
           * @returns {boolean}
           */
          prototypeAccessors.size.get = function () {
              return this.__entries__.length;
          };

          /**
           * @param {*} key
           * @returns {*}
           */
          anonymous.prototype.get = function (key) {
              var index = getIndex(this.__entries__, key);
              var entry = this.__entries__[index];

              return entry && entry[1];
          };

          /**
           * @param {*} key
           * @param {*} value
           * @returns {void}
           */
          anonymous.prototype.set = function (key, value) {
              var index = getIndex(this.__entries__, key);

              if (~index) {
                  this.__entries__[index][1] = value;
              } else {
                  this.__entries__.push([key, value]);
              }
          };

          /**
           * @param {*} key
           * @returns {void}
           */
          anonymous.prototype.delete = function (key) {
              var entries = this.__entries__;
              var index = getIndex(entries, key);

              if (~index) {
                  entries.splice(index, 1);
              }
          };

          /**
           * @param {*} key
           * @returns {void}
           */
          anonymous.prototype.has = function (key) {
              return !!~getIndex(this.__entries__, key);
          };

          /**
           * @returns {void}
           */
          anonymous.prototype.clear = function () {
              this.__entries__.splice(0);
          };

          /**
           * @param {Function} callback
           * @param {*} [ctx=null]
           * @returns {void}
           */
          anonymous.prototype.forEach = function (callback, ctx) {
              var this$1 = this;
              if ( ctx === void 0 ) ctx = null;

              for (var i = 0, list = this$1.__entries__; i < list.length; i += 1) {
                  var entry = list[i];

                  callback.call(ctx, entry[1], entry[0]);
              }
          };

          Object.defineProperties( anonymous.prototype, prototypeAccessors );

          return anonymous;
      }());
  })();

  /**
   * Detects whether window and document objects are available in current environment.
   */
  var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && window.document === document;

  // Returns global object of a current environment.
  var global$1 = (function () {
      if (typeof global !== 'undefined' && global.Math === Math) {
          return global;
      }

      if (typeof self !== 'undefined' && self.Math === Math) {
          return self;
      }

      if (typeof window !== 'undefined' && window.Math === Math) {
          return window;
      }

      // eslint-disable-next-line no-new-func
      return Function('return this')();
  })();

  /**
   * A shim for the requestAnimationFrame which falls back to the setTimeout if
   * first one is not supported.
   *
   * @returns {number} Requests' identifier.
   */
  var requestAnimationFrame$1 = (function () {
      if (typeof requestAnimationFrame === 'function') {
          // It's required to use a bounded function because IE sometimes throws
          // an "Invalid calling object" error if rAF is invoked without the global
          // object on the left hand side.
          return requestAnimationFrame.bind(global$1);
      }

      return function (callback) { return setTimeout(function () { return callback(Date.now()); }, 1000 / 60); };
  })();

  // Defines minimum timeout before adding a trailing call.
  var trailingTimeout = 2;

  /**
   * Creates a wrapper function which ensures that provided callback will be
   * invoked only once during the specified delay period.
   *
   * @param {Function} callback - Function to be invoked after the delay period.
   * @param {number} delay - Delay after which to invoke callback.
   * @returns {Function}
   */
  var throttle = function (callback, delay) {
      var leadingCall = false,
          trailingCall = false,
          lastCallTime = 0;

      /**
       * Invokes the original callback function and schedules new invocation if
       * the "proxy" was called during current request.
       *
       * @returns {void}
       */
      function resolvePending() {
          if (leadingCall) {
              leadingCall = false;

              callback();
          }

          if (trailingCall) {
              proxy();
          }
      }

      /**
       * Callback invoked after the specified delay. It will further postpone
       * invocation of the original function delegating it to the
       * requestAnimationFrame.
       *
       * @returns {void}
       */
      function timeoutCallback() {
          requestAnimationFrame$1(resolvePending);
      }

      /**
       * Schedules invocation of the original function.
       *
       * @returns {void}
       */
      function proxy() {
          var timeStamp = Date.now();

          if (leadingCall) {
              // Reject immediately following calls.
              if (timeStamp - lastCallTime < trailingTimeout) {
                  return;
              }

              // Schedule new call to be in invoked when the pending one is resolved.
              // This is important for "transitions" which never actually start
              // immediately so there is a chance that we might miss one if change
              // happens amids the pending invocation.
              trailingCall = true;
          } else {
              leadingCall = true;
              trailingCall = false;

              setTimeout(timeoutCallback, delay);
          }

          lastCallTime = timeStamp;
      }

      return proxy;
  };

  // Minimum delay before invoking the update of observers.
  var REFRESH_DELAY = 20;

  // A list of substrings of CSS properties used to find transition events that
  // might affect dimensions of observed elements.
  var transitionKeys = ['top', 'right', 'bottom', 'left', 'width', 'height', 'size', 'weight'];

  // Check if MutationObserver is available.
  var mutationObserverSupported = typeof MutationObserver !== 'undefined';

  /**
   * Singleton controller class which handles updates of ResizeObserver instances.
   */
  var ResizeObserverController = function() {
      this.connected_ = false;
      this.mutationEventsAdded_ = false;
      this.mutationsObserver_ = null;
      this.observers_ = [];

      this.onTransitionEnd_ = this.onTransitionEnd_.bind(this);
      this.refresh = throttle(this.refresh.bind(this), REFRESH_DELAY);
  };

  /**
   * Adds observer to observers list.
   *
   * @param {ResizeObserverSPI} observer - Observer to be added.
   * @returns {void}
   */


  /**
   * Holds reference to the controller's instance.
   *
   * @private {ResizeObserverController}
   */


  /**
   * Keeps reference to the instance of MutationObserver.
   *
   * @private {MutationObserver}
   */

  /**
   * Indicates whether DOM listeners have been added.
   *
   * @private {boolean}
   */
  ResizeObserverController.prototype.addObserver = function (observer) {
      if (!~this.observers_.indexOf(observer)) {
          this.observers_.push(observer);
      }

      // Add listeners if they haven't been added yet.
      if (!this.connected_) {
          this.connect_();
      }
  };

  /**
   * Removes observer from observers list.
   *
   * @param {ResizeObserverSPI} observer - Observer to be removed.
   * @returns {void}
   */
  ResizeObserverController.prototype.removeObserver = function (observer) {
      var observers = this.observers_;
      var index = observers.indexOf(observer);

      // Remove observer if it's present in registry.
      if (~index) {
          observers.splice(index, 1);
      }

      // Remove listeners if controller has no connected observers.
      if (!observers.length && this.connected_) {
          this.disconnect_();
      }
  };

  /**
   * Invokes the update of observers. It will continue running updates insofar
   * it detects changes.
   *
   * @returns {void}
   */
  ResizeObserverController.prototype.refresh = function () {
      var changesDetected = this.updateObservers_();

      // Continue running updates if changes have been detected as there might
      // be future ones caused by CSS transitions.
      if (changesDetected) {
          this.refresh();
      }
  };

  /**
   * Updates every observer from observers list and notifies them of queued
   * entries.
   *
   * @private
   * @returns {boolean} Returns "true" if any observer has detected changes in
   *  dimensions of it's elements.
   */
  ResizeObserverController.prototype.updateObservers_ = function () {
      // Collect observers that have active observations.
      var activeObservers = this.observers_.filter(function (observer) {
          return observer.gatherActive(), observer.hasActive();
      });

      // Deliver notifications in a separate cycle in order to avoid any
      // collisions between observers, e.g. when multiple instances of
      // ResizeObserver are tracking the same element and the callback of one
      // of them changes content dimensions of the observed target. Sometimes
      // this may result in notifications being blocked for the rest of observers.
      activeObservers.forEach(function (observer) { return observer.broadcastActive(); });

      return activeObservers.length > 0;
  };

  /**
   * Initializes DOM listeners.
   *
   * @private
   * @returns {void}
   */
  ResizeObserverController.prototype.connect_ = function () {
      // Do nothing if running in a non-browser environment or if listeners
      // have been already added.
      if (!isBrowser || this.connected_) {
          return;
      }

      // Subscription to the "Transitionend" event is used as a workaround for
      // delayed transitions. This way it's possible to capture at least the
      // final state of an element.
      document.addEventListener('transitionend', this.onTransitionEnd_);

      window.addEventListener('resize', this.refresh);

      if (mutationObserverSupported) {
          this.mutationsObserver_ = new MutationObserver(this.refresh);

          this.mutationsObserver_.observe(document, {
              attributes: true,
              childList: true,
              characterData: true,
              subtree: true
          });
      } else {
          document.addEventListener('DOMSubtreeModified', this.refresh);

          this.mutationEventsAdded_ = true;
      }

      this.connected_ = true;
  };

  /**
   * Removes DOM listeners.
   *
   * @private
   * @returns {void}
   */
  ResizeObserverController.prototype.disconnect_ = function () {
      // Do nothing if running in a non-browser environment or if listeners
      // have been already removed.
      if (!isBrowser || !this.connected_) {
          return;
      }

      document.removeEventListener('transitionend', this.onTransitionEnd_);
      window.removeEventListener('resize', this.refresh);

      if (this.mutationsObserver_) {
          this.mutationsObserver_.disconnect();
      }

      if (this.mutationEventsAdded_) {
          document.removeEventListener('DOMSubtreeModified', this.refresh);
      }

      this.mutationsObserver_ = null;
      this.mutationEventsAdded_ = false;
      this.connected_ = false;
  };

  /**
   * "Transitionend" event handler.
   *
   * @private
   * @param {TransitionEvent} event
   * @returns {void}
   */
  ResizeObserverController.prototype.onTransitionEnd_ = function (ref) {
          var propertyName = ref.propertyName; if ( propertyName === void 0 ) propertyName = '';

      // Detect whether transition may affect dimensions of an element.
      var isReflowProperty = transitionKeys.some(function (key) {
          return !!~propertyName.indexOf(key);
      });

      if (isReflowProperty) {
          this.refresh();
      }
  };

  /**
   * Returns instance of the ResizeObserverController.
   *
   * @returns {ResizeObserverController}
   */
  ResizeObserverController.getInstance = function () {
      if (!this.instance_) {
          this.instance_ = new ResizeObserverController();
      }

      return this.instance_;
  };

  ResizeObserverController.instance_ = null;

  /**
   * Defines non-writable/enumerable properties of the provided target object.
   *
   * @param {Object} target - Object for which to define properties.
   * @param {Object} props - Properties to be defined.
   * @returns {Object} Target object.
   */
  var defineConfigurable = (function (target, props) {
      for (var i = 0, list = Object.keys(props); i < list.length; i += 1) {
          var key = list[i];

          Object.defineProperty(target, key, {
              value: props[key],
              enumerable: false,
              writable: false,
              configurable: true
          });
      }

      return target;
  });

  /**
   * Returns the global object associated with provided element.
   *
   * @param {Object} target
   * @returns {Object}
   */
  var getWindowOf = (function (target) {
      // Assume that the element is an instance of Node, which means that it
      // has the "ownerDocument" property from which we can retrieve a
      // corresponding global object.
      var ownerGlobal = target && target.ownerDocument && target.ownerDocument.defaultView;

      // Return the local global object if it's not possible extract one from
      // provided element.
      return ownerGlobal || global$1;
  });

  // Placeholder of an empty content rectangle.
  var emptyRect = createRectInit(0, 0, 0, 0);

  /**
   * Converts provided string to a number.
   *
   * @param {number|string} value
   * @returns {number}
   */
  function toFloat(value) {
      return parseFloat(value) || 0;
  }

  /**
   * Extracts borders size from provided styles.
   *
   * @param {CSSStyleDeclaration} styles
   * @param {...string} positions - Borders positions (top, right, ...)
   * @returns {number}
   */
  function getBordersSize(styles) {
      var positions = [], len = arguments.length - 1;
      while ( len-- > 0 ) positions[ len ] = arguments[ len + 1 ];

      return positions.reduce(function (size, position) {
          var value = styles['border-' + position + '-width'];

          return size + toFloat(value);
      }, 0);
  }

  /**
   * Extracts paddings sizes from provided styles.
   *
   * @param {CSSStyleDeclaration} styles
   * @returns {Object} Paddings box.
   */
  function getPaddings(styles) {
      var positions = ['top', 'right', 'bottom', 'left'];
      var paddings = {};

      for (var i = 0, list = positions; i < list.length; i += 1) {
          var position = list[i];

          var value = styles['padding-' + position];

          paddings[position] = toFloat(value);
      }

      return paddings;
  }

  /**
   * Calculates content rectangle of provided SVG element.
   *
   * @param {SVGGraphicsElement} target - Element content rectangle of which needs
   *      to be calculated.
   * @returns {DOMRectInit}
   */
  function getSVGContentRect(target) {
      var bbox = target.getBBox();

      return createRectInit(0, 0, bbox.width, bbox.height);
  }

  /**
   * Calculates content rectangle of provided HTMLElement.
   *
   * @param {HTMLElement} target - Element for which to calculate the content rectangle.
   * @returns {DOMRectInit}
   */
  function getHTMLElementContentRect(target) {
      // Client width & height properties can't be
      // used exclusively as they provide rounded values.
      var clientWidth = target.clientWidth;
      var clientHeight = target.clientHeight;

      // By this condition we can catch all non-replaced inline, hidden and
      // detached elements. Though elements with width & height properties less
      // than 0.5 will be discarded as well.
      //
      // Without it we would need to implement separate methods for each of
      // those cases and it's not possible to perform a precise and performance
      // effective test for hidden elements. E.g. even jQuery's ':visible' filter
      // gives wrong results for elements with width & height less than 0.5.
      if (!clientWidth && !clientHeight) {
          return emptyRect;
      }

      var styles = getWindowOf(target).getComputedStyle(target);
      var paddings = getPaddings(styles);
      var horizPad = paddings.left + paddings.right;
      var vertPad = paddings.top + paddings.bottom;

      // Computed styles of width & height are being used because they are the
      // only dimensions available to JS that contain non-rounded values. It could
      // be possible to utilize the getBoundingClientRect if only it's data wasn't
      // affected by CSS transformations let alone paddings, borders and scroll bars.
      var width = toFloat(styles.width),
          height = toFloat(styles.height);

      // Width & height include paddings and borders when the 'border-box' box
      // model is applied (except for IE).
      if (styles.boxSizing === 'border-box') {
          // Following conditions are required to handle Internet Explorer which
          // doesn't include paddings and borders to computed CSS dimensions.
          //
          // We can say that if CSS dimensions + paddings are equal to the "client"
          // properties then it's either IE, and thus we don't need to subtract
          // anything, or an element merely doesn't have paddings/borders styles.
          if (Math.round(width + horizPad) !== clientWidth) {
              width -= getBordersSize(styles, 'left', 'right') + horizPad;
          }

          if (Math.round(height + vertPad) !== clientHeight) {
              height -= getBordersSize(styles, 'top', 'bottom') + vertPad;
          }
      }

      // Following steps can't be applied to the document's root element as its
      // client[Width/Height] properties represent viewport area of the window.
      // Besides, it's as well not necessary as the <html> itself neither has
      // rendered scroll bars nor it can be clipped.
      if (!isDocumentElement(target)) {
          // In some browsers (only in Firefox, actually) CSS width & height
          // include scroll bars size which can be removed at this step as scroll
          // bars are the only difference between rounded dimensions + paddings
          // and "client" properties, though that is not always true in Chrome.
          var vertScrollbar = Math.round(width + horizPad) - clientWidth;
          var horizScrollbar = Math.round(height + vertPad) - clientHeight;

          // Chrome has a rather weird rounding of "client" properties.
          // E.g. for an element with content width of 314.2px it sometimes gives
          // the client width of 315px and for the width of 314.7px it may give
          // 314px. And it doesn't happen all the time. So just ignore this delta
          // as a non-relevant.
          if (Math.abs(vertScrollbar) !== 1) {
              width -= vertScrollbar;
          }

          if (Math.abs(horizScrollbar) !== 1) {
              height -= horizScrollbar;
          }
      }

      return createRectInit(paddings.left, paddings.top, width, height);
  }

  /**
   * Checks whether provided element is an instance of the SVGGraphicsElement.
   *
   * @param {Element} target - Element to be checked.
   * @returns {boolean}
   */
  var isSVGGraphicsElement = (function () {
      // Some browsers, namely IE and Edge, don't have the SVGGraphicsElement
      // interface.
      if (typeof SVGGraphicsElement !== 'undefined') {
          return function (target) { return target instanceof getWindowOf(target).SVGGraphicsElement; };
      }

      // If it's so, then check that element is at least an instance of the
      // SVGElement and that it has the "getBBox" method.
      // eslint-disable-next-line no-extra-parens
      return function (target) { return target instanceof getWindowOf(target).SVGElement && typeof target.getBBox === 'function'; };
  })();

  /**
   * Checks whether provided element is a document element (<html>).
   *
   * @param {Element} target - Element to be checked.
   * @returns {boolean}
   */
  function isDocumentElement(target) {
      return target === getWindowOf(target).document.documentElement;
  }

  /**
   * Calculates an appropriate content rectangle for provided html or svg element.
   *
   * @param {Element} target - Element content rectangle of which needs to be calculated.
   * @returns {DOMRectInit}
   */
  function getContentRect(target) {
      if (!isBrowser) {
          return emptyRect;
      }

      if (isSVGGraphicsElement(target)) {
          return getSVGContentRect(target);
      }

      return getHTMLElementContentRect(target);
  }

  /**
   * Creates rectangle with an interface of the DOMRectReadOnly.
   * Spec: https://drafts.fxtf.org/geometry/#domrectreadonly
   *
   * @param {DOMRectInit} rectInit - Object with rectangle's x/y coordinates and dimensions.
   * @returns {DOMRectReadOnly}
   */
  function createReadOnlyRect(ref) {
      var x = ref.x;
      var y = ref.y;
      var width = ref.width;
      var height = ref.height;

      // If DOMRectReadOnly is available use it as a prototype for the rectangle.
      var Constr = typeof DOMRectReadOnly !== 'undefined' ? DOMRectReadOnly : Object;
      var rect = Object.create(Constr.prototype);

      // Rectangle's properties are not writable and non-enumerable.
      defineConfigurable(rect, {
          x: x, y: y, width: width, height: height,
          top: y,
          right: x + width,
          bottom: height + y,
          left: x
      });

      return rect;
  }

  /**
   * Creates DOMRectInit object based on the provided dimensions and the x/y coordinates.
   * Spec: https://drafts.fxtf.org/geometry/#dictdef-domrectinit
   *
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @param {number} width - Rectangle's width.
   * @param {number} height - Rectangle's height.
   * @returns {DOMRectInit}
   */
  function createRectInit(x, y, width, height) {
      return { x: x, y: y, width: width, height: height };
  }

  /**
   * Class that is responsible for computations of the content rectangle of
   * provided DOM element and for keeping track of it's changes.
   */
  var ResizeObservation = function(target) {
      this.broadcastWidth = 0;
      this.broadcastHeight = 0;
      this.contentRect_ = createRectInit(0, 0, 0, 0);

      this.target = target;
  };

  /**
   * Updates content rectangle and tells whether it's width or height properties
   * have changed since the last broadcast.
   *
   * @returns {boolean}
   */


  /**
   * Reference to the last observed content rectangle.
   *
   * @private {DOMRectInit}
   */


  /**
   * Broadcasted width of content rectangle.
   *
   * @type {number}
   */
  ResizeObservation.prototype.isActive = function () {
      var rect = getContentRect(this.target);

      this.contentRect_ = rect;

      return rect.width !== this.broadcastWidth || rect.height !== this.broadcastHeight;
  };

  /**
   * Updates 'broadcastWidth' and 'broadcastHeight' properties with a data
   * from the corresponding properties of the last observed content rectangle.
   *
   * @returns {DOMRectInit} Last observed content rectangle.
   */
  ResizeObservation.prototype.broadcastRect = function () {
      var rect = this.contentRect_;

      this.broadcastWidth = rect.width;
      this.broadcastHeight = rect.height;

      return rect;
  };

  var ResizeObserverEntry = function(target, rectInit) {
      var contentRect = createReadOnlyRect(rectInit);

      // According to the specification following properties are not writable
      // and are also not enumerable in the native implementation.
      //
      // Property accessors are not being used as they'd require to define a
      // private WeakMap storage which may cause memory leaks in browsers that
      // don't support this type of collections.
      defineConfigurable(this, { target: target, contentRect: contentRect });
  };

  var ResizeObserverSPI = function(callback, controller, callbackCtx) {
      this.activeObservations_ = [];
      this.observations_ = new MapShim();

      if (typeof callback !== 'function') {
          throw new TypeError('The callback provided as parameter 1 is not a function.');
      }

      this.callback_ = callback;
      this.controller_ = controller;
      this.callbackCtx_ = callbackCtx;
  };

  /**
   * Starts observing provided element.
   *
   * @param {Element} target - Element to be observed.
   * @returns {void}
   */


  /**
   * Registry of the ResizeObservation instances.
   *
   * @private {Map<Element, ResizeObservation>}
   */


  /**
   * Public ResizeObserver instance which will be passed to the callback
   * function and used as a value of it's "this" binding.
   *
   * @private {ResizeObserver}
   */

  /**
   * Collection of resize observations that have detected changes in dimensions
   * of elements.
   *
   * @private {Array<ResizeObservation>}
   */
  ResizeObserverSPI.prototype.observe = function (target) {
      if (!arguments.length) {
          throw new TypeError('1 argument required, but only 0 present.');
      }

      // Do nothing if current environment doesn't have the Element interface.
      if (typeof Element === 'undefined' || !(Element instanceof Object)) {
          return;
      }

      if (!(target instanceof getWindowOf(target).Element)) {
          throw new TypeError('parameter 1 is not of type "Element".');
      }

      var observations = this.observations_;

      // Do nothing if element is already being observed.
      if (observations.has(target)) {
          return;
      }

      observations.set(target, new ResizeObservation(target));

      this.controller_.addObserver(this);

      // Force the update of observations.
      this.controller_.refresh();
  };

  /**
   * Stops observing provided element.
   *
   * @param {Element} target - Element to stop observing.
   * @returns {void}
   */
  ResizeObserverSPI.prototype.unobserve = function (target) {
      if (!arguments.length) {
          throw new TypeError('1 argument required, but only 0 present.');
      }

      // Do nothing if current environment doesn't have the Element interface.
      if (typeof Element === 'undefined' || !(Element instanceof Object)) {
          return;
      }

      if (!(target instanceof getWindowOf(target).Element)) {
          throw new TypeError('parameter 1 is not of type "Element".');
      }

      var observations = this.observations_;

      // Do nothing if element is not being observed.
      if (!observations.has(target)) {
          return;
      }

      observations.delete(target);

      if (!observations.size) {
          this.controller_.removeObserver(this);
      }
  };

  /**
   * Stops observing all elements.
   *
   * @returns {void}
   */
  ResizeObserverSPI.prototype.disconnect = function () {
      this.clearActive();
      this.observations_.clear();
      this.controller_.removeObserver(this);
  };

  /**
   * Collects observation instances the associated element of which has changed
   * it's content rectangle.
   *
   * @returns {void}
   */
  ResizeObserverSPI.prototype.gatherActive = function () {
          var this$1 = this;

      this.clearActive();

      this.observations_.forEach(function (observation) {
          if (observation.isActive()) {
              this$1.activeObservations_.push(observation);
          }
      });
  };

  /**
   * Invokes initial callback function with a list of ResizeObserverEntry
   * instances collected from active resize observations.
   *
   * @returns {void}
   */
  ResizeObserverSPI.prototype.broadcastActive = function () {
      // Do nothing if observer doesn't have active observations.
      if (!this.hasActive()) {
          return;
      }

      var ctx = this.callbackCtx_;

      // Create ResizeObserverEntry instance for every active observation.
      var entries = this.activeObservations_.map(function (observation) {
          return new ResizeObserverEntry(observation.target, observation.broadcastRect());
      });

      this.callback_.call(ctx, entries, ctx);
      this.clearActive();
  };

  /**
   * Clears the collection of active observations.
   *
   * @returns {void}
   */
  ResizeObserverSPI.prototype.clearActive = function () {
      this.activeObservations_.splice(0);
  };

  /**
   * Tells whether observer has active observations.
   *
   * @returns {boolean}
   */
  ResizeObserverSPI.prototype.hasActive = function () {
      return this.activeObservations_.length > 0;
  };

  // Registry of internal observers. If WeakMap is not available use current shim
  // for the Map collection as it has all required methods and because WeakMap
  // can't be fully polyfilled anyway.
  var observers = typeof WeakMap !== 'undefined' ? new WeakMap() : new MapShim();

  /**
   * ResizeObserver API. Encapsulates the ResizeObserver SPI implementation
   * exposing only those methods and properties that are defined in the spec.
   */
  var ResizeObserver = function(callback) {
      if (!(this instanceof ResizeObserver)) {
          throw new TypeError('Cannot call a class as a function.');
      }
      if (!arguments.length) {
          throw new TypeError('1 argument required, but only 0 present.');
      }

      var controller = ResizeObserverController.getInstance();
      var observer = new ResizeObserverSPI(callback, controller, this);

      observers.set(this, observer);
  };

  // Expose public methods of ResizeObserver.
  ['observe', 'unobserve', 'disconnect'].forEach(function (method) {
      ResizeObserver.prototype[method] = function () {
          return (ref = observers.get(this))[method].apply(ref, arguments);
          var ref;
      };
  });

  var index = (function () {
      // Export existing implementation if available.
      if (typeof global$1.ResizeObserver !== 'undefined') {
          return global$1.ResizeObserver;
      }

      return ResizeObserver;
  })();

  return index;
  })));

  // @copyright
  //   © 2016-2017 Jarosław Foksa

  let templateElement = document.createElement("template");

  // @info
  //   Template string tag used to parse HTML strings.
  // @type
  //   () => HTMLElement || DocumentFragment
  let html = (strings, ...expressions) => {
    let parts = [];

    for (let i = 0; i < strings.length; i += 1) {
      parts.push(strings[i]);
      if (expressions[i] !== undefined) parts.push(expressions[i]);
    }

    let innerHTML = parts.join("");
    templateElement.innerHTML = innerHTML;
    let fragment = document.importNode(templateElement.content, true);

    if (fragment.children.length === 1) {
      return fragment.firstElementChild;
    }
    else {
      return fragment;
    }
  };

  // @info
  //   Template string tag used to parse SVG strings.
  // @type
  //   () => SVGElement || DocumentFragment
  let svg = (strings, ...expressions) => {
    let parts = [];

    for (let i = 0; i < strings.length; i += 1) {
      parts.push(strings[i]);
      if (expressions[i] !== undefined) parts.push(expressions[i]);
    }

    let innerHTML = `<svg id="x-stub" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;

    templateElement.innerHTML = innerHTML;

    let fragment = document.importNode(templateElement.content, true);
    let stub = fragment.querySelector("svg#x-stub");

    if (stub.children.length === 1) {
      return stub.firstElementChild;
    }
    else {
      for (let child of [...stub.childNodes]) {
        fragment.appendChild(child);
      }

      stub.remove();
      return fragment;
    }
  };

  // @info
  //   Same as document.createElement(), but you can also create SVG elements.
  // @type
  //   (string) => Element?
  let createElement = (name, is = null) => {
    let parts = name.split(":");
    let element = null;

    if (parts.length === 1) {
      let [localName] = parts;

      if (is === null) {
        element = document.createElement(localName);
      }
      else {
        element = document.createElement(localName, is);
      }
    }
    else if (parts.length === 2) {
      let [namespace, localName] = parts;

      if (namespace === "svg") {
        element = document.createElementNS("http://www.w3.org/2000/svg", localName);
      }
    }

    return element;
  };

  // @info
  //   Same as the standard document.elementFromPoint() moethod, but can also walk the shadow DOM.
  // @type
  //   (number, number, boolea) => Element?
  let elementFromPoint = (clientX, clientY, walkShadowDOM = true) => {
    let element = document.elementFromPoint(clientX, clientY);

    if (walkShadowDOM && element) {
      while (true) {
        let shadowRoot = (element.shadowRoot || element._shadowRoot);

        if (shadowRoot) {
          let descendantElement = shadowRoot.elementFromPoint(clientX, clientY);

          // @bugfix: https://bugs.chromium.org/p/chromium/issues/detail?id=843215
          if (descendantElement.getRootNode() !== shadowRoot) {
            descendantElement = null;
          }

          if (descendantElement && descendantElement !== element) {
            element = descendantElement;
          }
          else {
            break;
          }
        }
        else {
          break;
        }
      }
    }

    return element;
  };

  // @info
  //   Same as the standard element.closest() method but can also walk the shadow DOM.
  // @type
  //   (Element, string, boolean) => Element?
  let closest = (element, selector, walkShadowDOM = true) => {
    let matched = element.closest(selector);

    if (walkShadowDOM && !matched && element.getRootNode().host) {
      return closest(element.getRootNode().host, selector);
    }
    else {
      return matched;
    }
  };

  // @info
  //   Generate element ID that is unique in the given document fragment.
  // @type
  //   (DocumentFragment, string) => string
  let generateUniqueID = (fragment, prefix = "") => {
    let counter = 1;

    while (true) {
      let id = prefix + counter;

      if (fragment.querySelector("#" + CSS.escape(id)) === null) {
        return id;
      }
      else {
        counter += 1;
      }
    }
  };

  let {max} = Math;
  let easing = "cubic-bezier(0.4, 0, 0.2, 1)";

  let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
        --arrow-width: 24px;
        --arrow-height: 24px;
        --arrow-color: currentColor;
        --arrow-align: flex-end;
        --arrow-d: path("M 29.0 31.4 L 50 52.3 L 70.9 31.4 L 78.5 40.0 L 50 68.5 L 21.2 40.3 L 29.0 31.4 Z");
        --arrow-transform: rotate(0deg);
        --focused-arrow-background: transparent;
        --focused-arrow-outline: none;
        --trigger-effect: none; /* ripple, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.05;
      }
      :host([expanded]) {
        --arrow-transform: rotate(-180deg);
      }
      :host([animating]) {
        overflow: hidden;
      }

      #main {
        position: relative;
        width: 100%;
        height: 100%;
      }

      /**
       * Ripples
       */

      #ripples {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        border-radius: inherit;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 200px;
        height: 200px;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        transform: none;
        transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: opacity, transform;
        pointer-events: none;
      }

      /**
       * Arrow
       */

      #arrow-container {
        position: absolute;
        top: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: var(--arrow-align);
        pointer-events: none;
      }

      #arrow {
        margin: 0 14px 0 0;
        display: flex;
        width: var(--arrow-width);
        height: var(--arrow-height);
        min-width: var(--arrow-width);
        color: var(--arrow-color);
        d: var(--arrow-d);
        transform: var(--arrow-transform);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #arrow:focus {
        background: var(--focused-arrow-background);
        outline: var(--focused-arrow-outline);
      }

      #arrow path {
        fill: currentColor;
        d: inherit;
}
    </style>

    <main id="main">
      <div id="ripples"></div>

      <div id="arrow-container">
        <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none" tabindex="1">
          <path></path>
        </svg>
      </div>

      <slot></slot>
    </main>
  </template>
`;

  class XAccordionElement extends HTMLElement {
    static get observedAttributes() {
      return ["expanded"];
    }

    get expanded() {
      return this.hasAttribute("expanded");
    }
    set expanded(expanded) {
      expanded ? this.setAttribute("expanded", "") : this.removeAttribute("expanded");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this._resizeObserver = new ResizeObserver(() => this._updateArrowPosition());

      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this["#arrow"].addEventListener("keydown", (event) => this._onArrowKeyDown(event));
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "expanded") {
        this._updateArrowPosition();
      }
    }

    connectedCallback() {
      this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
      this._resizeObserver.unobserve(this);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateArrowPosition() {
      let header = this.querySelector(":scope > header");

      if (header) {
        this["#arrow-container"].style.height = header.getBoundingClientRect().height + "px";
      }
      else {
        this["#arrow-container"].style.height = null;
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onArrowKeyDown(event) {
      if (event.key === "Enter") {
        this.querySelector("header").click();
      }
    }

    async _onPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let header = this.querySelector("header");
      let closestFocusableElement = pointerDownEvent.target.closest("[tabindex]");

      if (header.contains(pointerDownEvent.target) && this.contains(closestFocusableElement) === false) {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        // Ripple
        if (triggerEffect === "ripple") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max(rect.width, rect.height) * 1.5;
          let top  = pointerDownEvent.clientY - rect.y - size/2;
          let left = pointerDownEvent.clientX - rect.x - size/2;

          let whenLostPointerCapture = new Promise((r) => {
            pointerDownEvent.target.addEventListener("lostpointercapture", r, {once: true});
          });

          pointerDownEvent.target.setPointerCapture(pointerDownEvent.pointerId);

          let ripple = html`<div></div>`;
          ripple.setAttribute("class", "ripple pointer-down-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

          this["#ripples"].append(ripple);
          this["#ripples"].style.contain = "strict";

          let inAnimation = ripple.animate(
            { transform: ["scale3d(0, 0, 0)", "none"]},
            { duration: 300, easing }
          );

          await whenLostPointerCapture;
          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"]},
            { duration: 300, easing }
          );

          await outAnimation.finished;
          ripple.remove();
        }
      }
    }

    async _onClick(event) {
      let header = this.querySelector("header");
      let closestFocusableElement = event.target.closest("[tabindex]");

      if (header.contains(event.target) && this.contains(closestFocusableElement) === false) {
        // Collapse
        if (this.expanded) {
          let startBBox = this.getBoundingClientRect();

          if (this._animation) {
            this._animation.finish();
          }

          this.expanded = false;
          this.removeAttribute("animating");
          let endBBox = this.getBoundingClientRect();
          this.setAttribute("animating", "");

          let animation = this.animate(
            {
              height: [startBBox.height + "px", endBBox.height + "px"],
            },
            {
              duration: 300,
              easing
            }
          );

          this._animation = animation;
          await animation.finished;

          if (this._animation === animation) {
            this.removeAttribute("animating");
          }
        }

        // Expand
        else {
          let startBBox = this.getBoundingClientRect();

          if (this._animation) {
            this._animation.finish();
          }

          this.expanded = true;
          this.removeAttribute("animating");
          let endBBox = this.getBoundingClientRect();
          this.setAttribute("animating", "");

          let animation = this.animate(
            {
              height: [startBBox.height + "px", endBBox.height + "px"],
            },
            {
              duration: 300,
              easing
            }
          );

          this._animation = animation;
          await animation.finished;

          if (this._animation === animation) {
            this.removeAttribute("animating");
          }
        }
      }
    }
  }

  customElements.define("x-accordion", XAccordionElement);

  let shadowTemplate$1 = html`
  <template>
    <style>
      :host {
        display: block;
        position: fixed;
        z-index: 1000;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        touch-action: none;
        will-change: opacity;
        cursor: default;
        background: rgba(0, 0, 0, 0.5);
      }
      :host([hidden]) {
        display: none;
      }
    </style>
  </template>
`;

  class XBackdropElement extends HTMLElement {
    // @info
    //   Element below which the backdrop should be placed.
    // @type
    //   HTMLElement
    get ownerElement() {
      return this._ownerElement ? this._ownerElement : document.body.firstElementChild;
    }
    set ownerElement(ownerElement) {
      this._ownerElement = ownerElement;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._ownerElement = null;
      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$1.content, true));

      this.addEventListener("wheel", (event) => event.preventDefault());
      this.addEventListener("pointerdown", (event) => event.preventDefault()); // Don't steal the focus
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    show(animate = true) {
      this.title = "";
      this.style.top = "0px";
      this.style.left = "0px";
      this.ownerElement.before(this);
      this.hidden = false;

      let bounds = this.getBoundingClientRect();
      let extraTop = 0;
      let extraLeft = 0;

      // Determine extraLeft and extraTop which represent the extra offset needed when the backdrop is inside another
      // fixed-positioned element such as a popover
      {
        if (bounds.top !== 0 || bounds.left !== 0) {
          extraTop = -bounds.top;
          extraLeft = -bounds.left;
        }
      }

      // Ensure the backdrop is stacked directly below the ref element
      {
        let zIndex = parseFloat(getComputedStyle(this.ownerElement).zIndex);
        this.style.zIndex = zIndex - 1;
      }

      this.style.top = (extraTop) + "px";
      this.style.left = (extraLeft) + "px";

      // Animate the backdrop
      if (animate) {
        let backdropAnimation = this.animate(
          {
            opacity: ["0", "1"]
          },
          {
            duration: 100,
            easing: "ease-out"
          }
        );

        return backdropAnimation.finished;
      }
    }

    hide(animate = true) {
      if (animate) {
        let backdropAnimation = this.animate(
          {
            opacity: ["1", "0"]
          },
          {
            duration: 100,
            easing: "ease-in"
          }
        );

        backdropAnimation.finished.then(() => {
          this.remove();
        });

        return backdropAnimation.finished;
      }
      else {
        this.remove();
      }
    }
  }

  customElements.define("x-backdrop", XBackdropElement);

  // @copyright
  //   © 2016-2017 Jarosław Foksa

  let {max: max$1, pow, sqrt, PI} = Math;

  // @info
  //   Round given number to the fixed number of decimal places.
  // @type
  //   (number, number) => number
  let round = (number, precision = 0) => {
    let coefficient = pow(10, precision);
    return Math.round(number * coefficient) / coefficient;
  };

  // @type
  //   (DOMRect, number) => DOMRect
  let roundRect = (rect, precision = 0) => {
    return new DOMRect(
      round(rect.x, precision),
      round(rect.y, precision),
      round(rect.width, precision),
      round(rect.height, precision)
    );
  };

  // @type
  //   (number, number, number, number?) => number
  let normalize = (number, min, max = Infinity, precision = null) => {
    if (precision !== null) {
      number = round(number, precision);
    }

    if (number < min) {
      number = min;
    }
    else if (number > max) {
      number = max;
    }

    return number;
  };

  // @type
  //   (number) => number
  let getPrecision = (number) => {
    if (!isFinite(number)) {
      return 0;
    }
    else {
      let e = 1;
      let p = 0;

      while (Math.round(number * e) / e !== number) {
        e *= 10;
        p += 1;
      }

      return p;
    }
  };

  // @info
  //   Get distance between two points.
  // @type
  //   (DOMPoint, DOMPoint) => number
  let getDistanceBetweenPoints = (point1, point2) => {
    let x = point2.x - point1.x;
    x = x * x;

    let y = point2.y - point1.y;
    y = y * y;

    let distance = sqrt(x+y);
    return distance;
  };

  // @type
  //   (DOMRect, DOMPoint) => boolean
  let rectContainsPoint = (rect, point) => {
    if (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    ) {
      return true;
    }
    else {
      return false;
    }
  };

  // @type
  //   (number) => number
  let degToRad = (degrees) => {
    let radians = (PI * degrees) / 180;
    return radians;
  };

  let {min, max: max$2, floor, pow: pow$1, atan2, PI: PI$1, sqrt: sqrt$1} = Math;
  let {parseFloat: parseFloat$1, parseInt: parseInt$1} = Number;

  // @info
  //   A list of named colors and their corresponding RGB values.
  // @doc
  //   http://www.w3.org/TR/css3-color/#svg-color
  let namedColors = {
                          // R,   G,   B
    aliceblue:            [240, 248, 255],
    antiquewhite:         [250, 235, 215],
    aqua:                 [  0, 255, 255],
    aquamarine:           [127, 255, 212],
    azure:                [240, 255, 255],
    beige:                [245, 245, 220],
    bisque:               [255, 228, 196],
    black:                [  0,   0   ,0],
    blanchedalmond:       [255, 235, 205],
    blue:                 [  0,   0, 255],
    blueviolet:           [138,  43, 226],
    brown:                [165,  42,  42],
    burlywood:            [222, 184, 135],
    cadetblue:            [ 95, 158, 160],
    chartreuse:           [127, 255,   0],
    chocolate:            [210, 105,  30],
    coral:                [255, 127,  80],
    cornflowerblue:       [100, 149, 237],
    cornsilk:             [255, 248, 220],
    crimson:              [220,  20,  60],
    cyan:                 [  0, 255, 255],
    darkblue:             [  0,   0, 139],
    darkcyan:             [  0, 139, 139],
    darkgoldenrod:        [184, 134,  11],
    darkgray:             [169, 169, 169],
    darkgreen:            [  0, 100,   0],
    darkgrey:             [169, 169, 169],
    darkkhaki:            [189, 183, 107],
    darkmagenta:          [139,   0, 139],
    darkolivegreen:       [ 85, 107,  47],
    darkorange:           [255, 140,   0],
    darkorchid:           [153,  50, 204],
    darkred:              [139,   0,   0],
    darksalmon:           [233, 150, 122],
    darkseagreen:         [143, 188, 143],
    darkslateblue:        [ 72,  61, 139],
    darkslategray:        [ 47,  79,  79],
    darkslategrey:        [ 47,  79,  79],
    darkturquoise:        [  0, 206, 209],
    darkviolet:           [148,   0, 211],
    deeppink:             [255,  20, 147],
    deepskyblue:          [  0, 191, 255],
    dimgray:              [105, 105, 105],
    dimgrey:              [105, 105, 105],
    dodgerblue:           [ 30, 144, 255],
    firebrick:            [178,  34,  34],
    floralwhite:          [255, 250, 240],
    forestgreen:          [ 34, 139,  34],
    fuchsia:              [255,   0, 255],
    gainsboro:            [220, 220, 220],
    ghostwhite:           [248, 248, 255],
    gold:                 [255, 215,   0],
    goldenrod:            [218, 165,  32],
    gray:                 [128, 128, 128],
    green:                [  0, 128,   0],
    greenyellow:          [173, 255,  47],
    grey:                 [128, 128, 128],
    honeydew:             [240, 255, 240],
    hotpink:              [255, 105, 180],
    indianred:            [205,  92,  92],
    indigo:               [ 75,   0, 130],
    ivory:                [255, 255, 240],
    khaki:                [240, 230, 140],
    lavender:             [230, 230, 250],
    lavenderblush:        [255, 240, 245],
    lawngreen:            [124, 252,   0],
    lemonchiffon:         [255, 250, 205],
    lightblue:            [173, 216, 230],
    lightcoral:           [240, 128, 128],
    lightcyan:            [224, 255, 255],
    lightgoldenrodyellow: [250, 250, 210],
    lightgray:            [211, 211, 211],
    lightgreen:           [144, 238, 144],
    lightgrey:            [211, 211, 211],
    lightpink:            [255, 182, 193],
    lightsalmon:          [255, 160, 122],
    lightseagreen:        [32,  178, 170],
    lightskyblue:         [135, 206, 250],
    lightslategray:       [119, 136, 153],
    lightslategrey:       [119, 136, 153],
    lightsteelblue:       [176, 196, 222],
    lightyellow:          [255, 255, 224],
    lime:                 [  0, 255,   0],
    limegreen:            [ 50, 205,  50],
    linen:                [250, 240, 230],
    magenta:              [255,   0 ,255],
    maroon:               [128,   0,   0],
    mediumaquamarine:     [102, 205, 170],
    mediumblue:           [  0,   0, 205],
    mediumorchid:         [186,  85, 211],
    mediumpurple:         [147, 112, 219],
    mediumseagreen:       [ 60, 179, 113],
    mediumslateblue:      [123, 104, 238],
    mediumspringgreen:    [  0, 250, 154],
    mediumturquoise:      [ 72, 209, 204],
    mediumvioletred:      [199,  21, 133],
    midnightblue:         [ 25,  25, 112],
    mintcream:            [245, 255, 250],
    mistyrose:            [255, 228, 225],
    moccasin:             [255, 228, 181],
    navajowhite:          [255, 222, 173],
    navy:                 [  0,   0, 128],
    oldlace:              [253, 245, 230],
    olive:                [128, 128,   0],
    olivedrab:            [107, 142,  35],
    orange:               [255, 165,   0],
    orangered:            [255,  69,   0],
    orchid:               [218, 112, 214],
    palegoldenrod:        [238, 232, 170],
    palegreen:            [152, 251, 152],
    paleturquoise:        [175, 238, 238],
    palevioletred:        [219, 112, 147],
    papayawhip:           [255, 239, 213],
    peachpuff:            [255, 218, 185],
    peru:                 [205, 133,  63],
    pink:                 [255, 192, 203],
    plum:                 [221, 160, 221],
    powderblue:           [176, 224, 230],
    purple:               [128,   0, 128],
    red:                  [255,   0,   0],
    rosybrown:            [188, 143, 143],
    royalblue:            [ 65, 105, 225],
    saddlebrown:          [139,  69,  19],
    salmon:               [250, 128, 114],
    sandybrown:           [244, 164,  96],
    seagreen:             [46,  139,  87],
    seashell:             [255, 245, 238],
    sienna:               [160,  82,  45],
    silver:               [192, 192, 192],
    skyblue:              [135, 206, 235],
    slateblue:            [106,  90, 205],
    slategray:            [112, 128, 144],
    slategrey:            [112, 128, 144],
    snow:                 [255, 250, 250],
    springgreen:          [  0, 255, 127],
    steelblue:            [ 70, 130, 180],
    tan:                  [210, 180, 140],
    teal:                 [  0, 128, 128],
    thistle:              [216, 191, 216],
    tomato:               [255,  99,  71],
    turquoise:            [ 64, 224, 208],
    violet:               [238, 130, 238],
    wheat:                [245, 222, 179],
    white:                [255, 255, 255],
    whitesmoke:           [245, 245, 245],
    yellow:               [255, 255,   0],
    yellowgreen:          [154, 205,  50]
  };

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  class StringScanner {
    // @type
    //   (string) => void
    constructor(text) {
      this.text = text;

      this.cursor = 0;
      this.line = 1;
      this.column = 1;

      this._storedPosition = {cursor: 0, line: 1, column: 1};
    }

    // @info
    //   Read given number of chars.
    // @type
    //   (number) => string?
    read(i = 1) {
      let string = "";
      let initialCursor = this.cursor;

      for (let j = 0; j < i; j += 1) {
        let c = this.text[initialCursor + j];

        if (c === undefined) {
          break;
        }
        else {
          string += c;
          this.cursor += 1;

          if (c === "\n"){
            this.line += 1;
            this.column = 1;
          }
          else {
            this.column += 1;
          }
        }
      }

      return (string === "" ? null : string);
    }

    // @info
    //   Read given number of chars without advancing the cursor.
    // @type
    //   (number) => string?
    peek(i = 1) {
      let string = "";

      for (let j = 0; j < i; j += 1) {
        let c = this.text[this.cursor + j];

        if (c === undefined) {
          break;
        }
        else {
          string += c;
        }
      }

      return (string === "" ? null : string);
    }

    // @type
    //   () => void
    storePosition() {
      let {cursor, line, column} = this;
      this._storedPosition = {cursor, line, column};
    }

    // @type
    //   () => void
    restorePosition() {
      let {cursor, line, column} = this._storedPosition;

      this.cursor = cursor;
      this.line = line;
      this.column = column;
    }
  }

  ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Convert color from RGB to HSL space. R, G and B components on input must be in 0-255 range.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let rgbToHsl = (r, g, b) => {
    r = r / 255;
    g = g / 255;
    b = b / 255;

    let maxValue = max$2(r, g, b);
    let minValue = min(r, g, b);

    let h;
    let s;
    let l;

    h = s = l = (maxValue + minValue) / 2;

    if (maxValue === minValue) {
      h = s = 0;
    }
    else {
      let d = maxValue - minValue;

      if (l > 0.5) {
        s = d / (2 - maxValue - minValue);
      }
      else {
        s = d / (maxValue + minValue);
      }

      if (maxValue === r) {
        let z;

        if (g < b) {
          z = 6;
        }
        else {
          z = 0;
        }

        h = (g - b) / d + z;
      }

      else if (maxValue === g) {
        h = (b - r) / d + 2;
      }

      else if (maxValue === b) {
        h = (r - g) / d + 4;
      }
    }

    h = normalize((h / 6) * 360, 0, 360, 0);
    s = normalize(s * 100, 0, 100, 1);
    l = normalize(l * 100, 0, 100, 1);

    return [h, s, l];
  };

  // @info
  //   Convert color from HSL to RGB space. Input H must be in 0-360 range, S and L must be in
  //   0-100 range.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let hslToRgb = (h, s, l) => {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r;
    let g;
    let b;

    if (s === 0) {
      r = g = b = l;
    }
    else {
      let hue2rgb = (p, q, t) => {
        if (t < 0) {
          t += 1;
        }
        if (t > 1) {
          t -= 1;
        }
        if (t < 1/6) {
          return p + (q - p) * 6 * t;
        }
        if (t < 1/2) {
          return q;
        }
        if (t < 2/3) {
          return p + (q - p) * (2/3 - t) * 6;
        }

        return p;
      };

      let q;
      let p;

      if (l < 0.5) {
        q = l * (1 + s);
      }
      else {
        q = l + s - l * s;
      }

      p = 2 * l - q;

      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    r = normalize(255 * r, 0, 255, 0);
    g = normalize(255 * g, 0, 255, 0);
    b = normalize(255 * b, 0, 255, 0);

    return [r, g, b];
  };

  // @info
  //   Convert color from RGB to HSV space.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let rgbToHsv = (r, g, b) => {
    r = r / 255;
    g = g / 255;
    b = b / 255;

    let maxValue = max$2(r, g, b);
    let minValue = min(r, g, b);

    let h = 0;
    let s = 0;
    let v = maxValue;
    let d = maxValue - minValue;

    if (maxValue === 0) {
      s = 0;
    }
    else {
      s = d / maxValue;
    }

    if (maxValue === minValue) {
      h = 0;
    }
    else {
      if (maxValue === r) {
        h = (g - b) / d + (g < b ? 6 : 0);
      }
      else if (maxValue === g) {
        h = (b - r) / d + 2;
      }
      else if (maxValue === b) {
        h = (r - g) / d + 4;
      }

      h = h / 6;
    }

    h = h * 360;
    s = s * 100;
    v = v * 100;

    return [h, s, v];
  };

  // @info
  //   Convert color from HSV to RGB space.
  // @src
  //   http://goo.gl/J9ra3
  // @type
  //   (number, number, number) => [number, number, number]
  let hsvToRgb = (h, s, v) => {
    h = h / 360;
    s = s / 100;
    v = v / 100;

    let i = floor(h * 6);
    let f = (h * 6) - i;
    let p = v * (1 - s);
    let q = v * (1 - (f * s));
    let t = v * (1 - (1 - f) * s);

    let r = 0;
    let g = 0;
    let b = 0;

    if (i % 6 === 0) {
      r = v;
      g = t;
      b = p;
    }

    else if (i % 6 === 1) {
      r = q;
      g = v;
      b = p;
    }

    else if (i % 6 === 2) {
      r = p;
      g = v;
      b = t;
    }

    else if (i % 6 === 3) {
      r = p;
      g = q;
      b = v;
    }

    else if (i % 6 === 4) {
      r = t;
      g = p;
      b = v;
    }

    else if (i % 6 === 5) {
      r = v;
      g = p;
      b = q;
    }

    r = r * 255;
    g = g * 255;
    b = b * 255;

    return [r, g, b];
  };

  // @info
  //   Convert color from HSL to HSV space.
  // @src
  //   http://ariya.blogspot.com/2008/07/converting-between-hsl-and-hsv.html
  // @type
  //   (number, number, number) => [number, number, number]
  let hslToHsv = (h, s, l) => {
    h = h / 360;
    s = s / 100;
    l = (l / 100) * 2;

    if (l <= 1) {
      s = s * l;
    }
    else {
      s = s * (2 - l);
    }

    let hh = h;
    let ss;
    let vv;

    if ((l + s) === 0) {
      ss = 0;
    }
    else {
      ss = (2 * s) / (l + s);
    }

    vv = (l + s) / 2;

    hh = 360 * hh;
    ss = max$2(0, min(1, ss)) * 100;
    vv = max$2(0, min(1, vv)) * 100;

    return [hh, ss, vv];
  };

  // @info
  //   Convert color from HSV to HSL space.
  // @src
  //   http://ariya.blogspot.com/2008/07/converting-between-hsl-and-hsv.html
  // @type
  //   (number, number, number) => [number, number, number]
  let hsvToHsl = (h, s, v) => {
    h = h / 360;
    s = s / 100;
    v = v / 100;

    let hh = h;
    let ll = (2 - s) * v;
    let ss = s * v;

    if (ll <= 1) {
      if (ll === 0) {
        ss = 0;
      }
      else {
        ss = ss / ll;
      }
    }
    else if (ll === 2) {
      ss = 0;
    }
    else {
      ss = ss / (2 - ll);
    }

    ll = ll / 2;

    hh = 360 * hh;
    ss = max$2(0, min(1, ss)) * 100;
    ll = max$2(0, min(1, ll)) * 100;

    return [hh, ss, ll];
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Parse given CSS color string into corresponding RGBA, HSLA or HSVA components.
  // @type
  //   outputModel = "rgba" || "hsla" || "hsva"
  //   components = Array<number, number, number, number>
  //   (string, outputModel) => components
  let parseColor = (colorString, outputModel = "rgba") => {
    colorString = colorString.trim();

    let tokens = tokenizeColor(colorString);
    let rgbaComponents = null;
    let hslaComponents = null;

    // RGB, e.g. rgb(100, 100, 100)

    if (
      tokens.length === 7 &&
      tokens[0].text === "rgb(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "NUM" &&
      tokens[4].text === "," &&
      tokens[5].type === "NUM" &&
      tokens[6].text === ")"
    ) {
      rgbaComponents = [
        parseFloat$1(tokens[1].text),
        parseFloat$1(tokens[3].text),
        parseFloat$1(tokens[5].text),
        1,
      ];
    }

    // RGB with percentages, e.g. rgb(50%, 50%, 50%)

    else if (
      tokens.length === 7 &&
      tokens[0].text === "rgb(" &&
      tokens[1].type === "PERCENTAGE" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === ")"
    ) {
      rgbaComponents = [
        (parseFloat$1(tokens[1].text)/100) * 255,
        (parseFloat$1(tokens[3].text)/100) * 255,
        (parseFloat$1(tokens[5].text)/100) * 255,
        1,
      ];
    }

    // RGBA, e.g. rgba(100, 100, 100, 0.5)

    else if (
      tokens.length === 9 &&
      tokens[0].text === "rgba(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "NUM" &&
      tokens[4].text === "," &&
      tokens[5].type === "NUM" &&
      tokens[6].text === "," &&
      tokens[7].type === "NUM" &&
      tokens[8].text === ")"
    ) {
      rgbaComponents = [
        parseFloat$1(tokens[1].text),
        parseFloat$1(tokens[3].text),
        parseFloat$1(tokens[5].text),
        parseFloat$1(tokens[7].text),
      ];
    }

    // RGBA with percentages, e.g. rgba(50%, 50%, 50%, 0.5)

    else if (
      tokens.length === 9 &&
      tokens[0].text === "rgb(" &&
      tokens[1].type === "PERCENTAGE" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === ","&&
      tokens[7].type === "NUM" &&
      tokens[8].text === ")"
    ) {
      rgbaComponents = [
        (parseFloat$1(tokens[1].text)/100) * 255,
        (parseFloat$1(tokens[3].text)/100) * 255,
        (parseFloat$1(tokens[5].text)/100) * 255,
        parseFloat$1(tokens[7].text),
      ];
    }

    // HSL, e.g. hsl(360, 100%, 100%)

    else if (
      tokens.length === 7 &&
      tokens[0].text === "hsl(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === ")"
    ) {
      hslaComponents = [
        parseFloat$1(tokens[1].text),
        parseFloat$1(tokens[3].text),
        parseFloat$1(tokens[5].text),
        1,
      ];
    }

    // HSLA, e.g. hsla(360, 100%, 100%, 1)

    else if (
      tokens.length === 9 &&
      tokens[0].text === "hsla(" &&
      tokens[1].type === "NUM" &&
      tokens[2].text === "," &&
      tokens[3].type === "PERCENTAGE" &&
      tokens[4].text === "," &&
      tokens[5].type === "PERCENTAGE" &&
      tokens[6].text === "," &&
      tokens[7].type === "NUM" &&
      tokens[8].text === ")"
    ) {
      hslaComponents = [
        parseFloat$1(tokens[1].text),
        parseFloat$1(tokens[3].text),
        parseFloat$1(tokens[5].text),
        parseFloat$1(tokens[7].text),
      ];
    }

    // HEX, e.g. "#fff"

    else if (tokens[0].type === "HEX" && tokens[1] === undefined) {
      let hexString = tokens[0].text.substring(1); // get rid of leading "#"

      let hexRed;
      let hexGreen;
      let hexBlue;

      if (hexString.length === 3) {
        hexRed   = hexString[0] + hexString[0];
        hexGreen = hexString[1] + hexString[1];
        hexBlue  = hexString[2] + hexString[2];
      }
      else {
        hexRed   = hexString[0] + hexString[1];
        hexGreen = hexString[2] + hexString[3];
        hexBlue  = hexString[4] + hexString[5];
      }

      rgbaComponents = [
        parseInt$1(hexRed, 16),
        parseInt$1(hexGreen, 16),
        parseInt$1(hexBlue, 16),
        1,
      ];
    }

    // Named color, e.g. "white"

    else if (namedColors[colorString]) {
      rgbaComponents = [
        namedColors[colorString][0],
        namedColors[colorString][1],
        namedColors[colorString][2],
        1,
      ];
    }

    // Finalize

    if (rgbaComponents) {
      let [r, g, b, a] = rgbaComponents;

      r = normalize(r, 0, 255, 0);
      g = normalize(g, 0, 255, 0);
      b = normalize(b, 0, 255, 0);
      a = normalize(a, 0, 1, 2);

      if (outputModel === "hsla") {
        let [h, s, l] = rgbToHsl(r, g, b);
        return [h, s, l, a];
      }
      else if (outputModel === "hsva") {
        let [h, s, v] = rgbToHsv(r, g, b);
        return [h, s, v, a];
      }
      else {
        return [r, g, b, a];
      }
    }
    else if (hslaComponents) {
      let [h, s, l, a] = hslaComponents;

      h = normalize(h, 0, 360, 0);
      s = normalize(s, 0, 100, 1);
      l = normalize(l, 0, 100, 1);
      a = normalize(a, 0, 1, 2);

      if (outputModel === "hsla") {
        return [h, s, l, a];
      }
      else if (outputModel === "hsva") {
        let [hh, ss, vv] = hslToHsv(h, s, l);
        return [hh, ss, vv, a];
      }
      else {
        let [r, g, b] = hslToRgb(h, s, l);
        return [r, g, b, a];
      }
    }
    else {
      throw new Error(`Invalid color string: "${colorString}"`);
    }
  };

  // @type
  //   components = Array<number, number, number, number>
  //   inputModel = "rgba" || "hsla" || "hsva"
  //   outputFormat = "rgb" || "rgba" || "rgb%" || "rgba%" || "hex" || "hsl" || "hsla"
  //   (components, inputModel, outputFormat) => string
  let serializeColor = (components, inputModel = "rgba", outputFormat = "hex") => {
    let string = null;

    // RGB(A) output
    if (["rgb", "rgba", "rgb%", "rgba%", "hex"].includes(outputFormat)) {
      let r;
      let g;
      let b;
      let a;

      if (inputModel === "rgba") {
        [r, g, b, a] = components;
      }
      else if (inputModel === "hsla") {
        [r, g, b] = hslToRgb(...components);
        a = components[3];
      }
      else if (inputModel === "hsva") {
        [r, g, b] = hsvToRgb(...components);
        a = components[3];
      }

      if (outputFormat === "rgb%" || outputFormat === "rgba%") {
        r = normalize((r/255) * 100, 0, 100, 1);
        g = normalize((g/255) * 100, 0, 100, 1);
        b = normalize((b/255) * 100, 0, 100, 1);
        a = normalize(a, 0, 1, 2);
      }
      else {
        r = normalize(r, 0, 255, 0);
        g = normalize(g, 0, 255, 0);
        b = normalize(b, 0, 255, 0);
        a = normalize(a, 0, 1, 2);
      }

      if (outputFormat === "rgb") {
        string = `rgb(${r}, ${g}, ${b})`;
      }
      else if (outputFormat === "rgba") {
        string = `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      else if (outputFormat === "rgb%") {
        string = `rgb(${r}%, ${g}%, ${b}%)`;
      }
      else if (outputFormat === "rgba%") {
        string = `rgb(${r}%, ${g}%, ${b}%, ${a})`;
      }
      else if (outputFormat === "hex") {
        let hexRed   = r.toString(16);
        let hexGreen = g.toString(16);
        let hexBlue  = b.toString(16);

        if (hexRed.length === 1) {
          hexRed = "0" + hexRed;
        }
        if (hexGreen.length === 1) {
          hexGreen = "0" + hexGreen;
        }
        if (hexBlue.length === 1) {
          hexBlue = "0" + hexBlue;
        }

        string = "#" + hexRed + hexGreen + hexBlue;
      }
    }

    // HSL(A) space
    else if (outputFormat === "hsl" || outputFormat === "hsla") {
      let h;
      let s;
      let l;
      let a;

      if (inputModel === "hsla") {
        [h, s, l, a] = components;
      }
      else if (inputModel === "hsva") {
        [h, s, l] = hsvToHsl(...components);
        a = components[3];
      }
      else if (inputModel === "rgba") {
        [h, s, l] = rgbToHsl(...components);
        a = components[3];
      }

      h = normalize(h, 0, 360, 0);
      s = normalize(s, 0, 100, 1);
      l = normalize(l, 0, 100, 1);
      a = normalize(a, 0, 1, 2);

      if (outputFormat === "hsl") {
        string = `hsl(${h}, ${s}%, ${l}%)`;
      }
      else if (outputFormat === "hsla") {
        string = `hsla(${h}, ${s}%, ${l}%, ${a})`;
      }
    }

    return string;
  };

  // @info
  //   Convert CSS color string into an array of tokens.
  //   -----------------------------------
  //   Token type    Sample token text
  //   -----------------------------------
  //   "FUNCTION"    "rgb(", "hsla("
  //   "HEX"         "#000", "#bada55"
  //   "NUMBER"      "100", ".2", "10.3234"
  //   "PERCENTAGE"  "100%", "0.2%"
  //   "CHAR"        ")", ","
  // @type
  //   type Token = {type: string, text: string}
  //   (string) => Array<Token>
  let tokenizeColor = (cssText) => {
    let tokens = [];
    let scanner = new StringScanner(cssText.toLowerCase());

    while (scanner.peek() !== null) {
      let char = scanner.read();

      (() => {
        // FUNCTION
        if (char === "r" || char === "h") {
          let text = char;

          if (char + scanner.peek(3) === "rgb(") {
            text += scanner.read(3);
          }
          else if (char + scanner.peek(4) === "rgba(") {
            text += scanner.read(4);
          }
          else if (char + scanner.peek(3) === "hsl(") {
            text += scanner.read(3);
          }
          else if (char + scanner.peek(4) === "hsla(") {
            text += scanner.read(4);
          }

          if (text !== char) {
            tokens.push({type: "FUNCTION", text: text});
            return;
          }
        }

        // HEX
        if (char === "#") {
          if (isHexColorString(char + scanner.peek(6))) {
            let text = char + scanner.read(6);
            tokens.push({type: "HEX", text: text});
            return;
          }

          else if (isHexColorString(char + scanner.peek(3))) {
            let text = char + scanner.read(3);
            tokens.push({type: "HEX", text: text});
            return;
          }
        }

        // NUMBER
        // PERCENTAGE
        if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "-"].includes(char)) {
          let text = char;

          while (true) {
            if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."].includes(scanner.peek())) {
              text += scanner.read();
            }
            else {
              break;
            }
          }

          if (scanner.peek() === "%") {
            text += scanner.read();
            tokens.push({type: "PERCENTAGE", text: text});
          }
          else {
            tokens.push({type: "NUM", text: text});
          }

          return;
        }

        // S
        if (/\u0009|\u000a|\u000c|\u000d|\u0020/.test(char)) {
          // Don't tokenize whitespace as it's meaningless
          return;
        }

        // CHAR
        tokens.push({type: "CHAR", text: char});
        return;
      })();
    }

    return tokens;
  };

  // @type
  //   format = "rgb" || "rgba" || "rgb%" || "rgba%" || "hex" || "hsl" || "hsla"
  //   (string, format) => string
  let formatColorString = (colorString, format) => {
    let model = format.startsWith("hsl") ? "hsla" : "rgba";
    let components = parseColor(colorString, model);
    let formattedColorString = serializeColor(components, model, format);
    return formattedColorString;
  };

  // @info
  //   Check if string represents a valid hex color, e.g. "#fff", "#bada55".
  // @type
  //   (string) => boolean
  let isHexColorString = (string) => {
    string = string.toLowerCase();

    if (string[0] !== "#") {
      return false;
    }
    else if (string.length !== 4 && string.length !== 7) {
      return false;
    }
    else {
      string = string.substring(1); // get rid of "#"
    }

    let hexDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

    for (let digit of string) {
      if (!hexDigits.includes(digit)) {
        return false;
      }
    }

    return true;
  };

  // @info
  //   Check if string contains valid CSS3 color, e.g. "blue", "#fff", "rgb(50, 50, 100)".
  // @type
  //   (string) => boolean
  let isValidColorString = (string) => {
    try {
      parseColor(string);
    }
    catch (error) {
      return false;
    }

    return true;
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @info
  //   Get blob URL for color wheel image (HSV spectrum) used by the color pickers.
  let getColorWheelImageURL = () => {
    return new Promise((resolve) => {
      if (getColorWheelImageURL.url) {
        resolve(getColorWheelImageURL.url);
      }
      else if (getColorWheelImageURL.callbacks) {
        getColorWheelImageURL.callbacks.push(resolve);
      }
      else {
        getColorWheelImageURL.callbacks = [resolve];

        let size = 300;
        let canvas = document.createElement("canvas");
        let context = canvas.getContext("2d");
        let imageData = context.createImageData(size, size);
        let data = imageData.data;
        let radius = size / 2;
        let i = 0;

        canvas.width = size;
        canvas.height = size;

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            let rx = x - radius;
            let ry = y - radius;
            let d = pow$1(rx, 2) + pow$1(ry, 2);

            let h = ((atan2(ry, rx) + PI$1) / (PI$1 * 2)) * 360;
            let s = (sqrt$1(d) / radius) * 100;

            let [r, g, b] = hsvToRgb(h, s, 100);
            let a = (d > pow$1(radius, 2)) ? 0 : 255;

            data[i++] = r;
            data[i++] = g;
            data[i++] = b;
            data[i++] = a;
          }
        }

        context.putImageData(imageData, 0, 0);

        canvas.toBlob((blob) => {
          getColorWheelImageURL.url = URL.createObjectURL(blob);

          for (let callback of getColorWheelImageURL.callbacks) {
            callback(getColorWheelImageURL.url);
          }
        });
      }
    });
  };

  let shadowHTML = `
  <style>
    :host {
      display: block;
      width: 100%;
      user-select: none;
    }
    :host([hidden]) {
      display: none;
    }

    /**
     * Hue slider
     */

    #hue-slider {
      width: 100%;
      height: 28px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      background: red;
      --marker-width: 18px;
    }

    #hue-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      background: linear-gradient(to right,
        rgba(255, 0, 0, 1),
        rgba(255, 255, 0, 1),
        rgba(0, 255, 0, 1),
        rgba(0, 255, 255, 1),
        rgba(0, 0, 255, 1),
        rgba(255, 0, 255, 1),
        rgba(255, 0, 0, 1)
      );
    }

    #hue-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }

    /**
     * Saturation slider
     */

    #saturation-slider {
      width: 100%;
      height: 28px;
      margin-top: 20px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
    }

    #saturation-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #saturation-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }

    /**
     * Lightness slider
     */

    #lightness-slider {
      width: 100%;
      height: 28px;
      margin-top: 20px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
    }

    #lightness-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #lightness-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }

    /**
     * Alpha slider
     */

    #alpha-slider {
      display: none;
      width: 100%;
      height: 28px;
      margin-top: 20px;
      margin-bottom: 8px;
      padding: 0 calc(var(--marker-width) / 2);
      position: relative;
      box-sizing: border-box;
      border: 1px solid #cecece;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
      /* Checkerboard pattern */
      background-color: white;
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
      background-image: linear-gradient(45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(-45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #d6d6d6 75%),
                        linear-gradient(-45deg, transparent 75%, #d6d6d6 75%);
    }
    :host([alphaslider]) #alpha-slider {
      display: block;
    }

    #alpha-slider-gradient {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    #alpha-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #alpha-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }
  </style>

  <x-box vertical>
    <div id="hue-slider">
      <div id="hue-slider-track">
        <div id="hue-slider-marker"></div>
      </div>
    </div>

    <div id="saturation-slider">
      <div id="saturation-slider-track">
        <div id="saturation-slider-marker"></div>
      </div>
    </div>

    <div id="lightness-slider">
      <div id="lightness-slider-track">
        <div id="lightness-slider-marker"></div>
      </div>
    </div>

    <div id="alpha-slider">
      <div id="alpha-slider-gradient"></div>
      <div id="alpha-slider-track">
        <div id="alpha-slider-marker"></div>
      </div>
    </div>
  </x-box>
`;

  // @events
  //   change
  //   changestart
  //   changeend
  class XBarsColorPickerElement extends HTMLElement {
    static get observedAttributes() {
      return ["value"];
    }

    // @type
    //   string
    // @default
    //   "hsla(0, 0%, 100%, 1)"
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : "hsla(0, 0%, 100%, 1)";
    }
    set value(value) {
      this.setAttribute("value", value);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._h = 0;  // Hue (0 ~ 360)
      this._s = 0;  // Saturation (0 ~ 100)
      this._l = 80; // Lightness (0 ~ 100)
      this._a = 1;  // Alpha (0 ~ 1)

      this._isDraggingHueSliderMarker = false;
      this._isDraggingSaturationSliderMarker = false;
      this._isDraggingLightnessSliderMarker = false;
      this._isDraggingAlphaSliderMarker = false;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.innerHTML = shadowHTML;

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#hue-slider"].addEventListener("pointerdown", (event) => this._onHueSliderPointerDown(event));
      this["#saturation-slider"].addEventListener("pointerdown", (event) => this._onSaturationSliderPointerDown(event));
      this["#lightness-slider"].addEventListener("pointerdown", (event) => this._onLightnessSliderPointerDown(event));
      this["#alpha-slider"].addEventListener("pointerdown", (event) => this._onAlphaSliderPointerDown(event));
    }

    connectedCallback() {
      this._update();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "value") {
        this._onValueAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      this._updateHueSliderMarker();

      this._udpateSaturationSliderMarker();
      this._udpateSaturationSliderBackground();

      this._udpateLightnessSliderMarker();
      this._udpateLightnessSliderBackground();

      this._updateAlphaSliderMarker();
      this._updateAlphaSliderBackground();
    }

    _updateHueSliderMarker() {
      this["#hue-slider-marker"].style.left = ((normalize(this._h, 0, 360, 0) / 360) * 100) + "%";
    }

    _udpateSaturationSliderMarker() {
      this["#saturation-slider-marker"].style.left = normalize(this._s, 0, 100, 2) + "%";
    }

    _udpateLightnessSliderMarker() {
      this["#lightness-slider-marker"].style.left = normalize(this._l, 0, 100, 2) + "%";
    }

    _updateAlphaSliderMarker() {
      this["#alpha-slider-marker"].style.left = normalize((1 - this._a) * 100, 0, 100, 2) + "%";
    }

    _udpateSaturationSliderBackground() {
      let h = this._h;

      this["#saturation-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, 0%, 50%), hsl(${h}, 100%, 50%)
    )`;
    }

    _udpateLightnessSliderBackground() {
      let h = this._h;
      let s = this._s;

      this["#lightness-slider"].style.background = `linear-gradient(
      to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%)
    )`;
    }

    _updateAlphaSliderBackground() {
      let h = this._h;
      let s = this._s;
      let l = this._l;

      this["#alpha-slider-gradient"].style.background = `
      linear-gradient(to right, hsla(${h}, ${s}%, ${l}%, 1), hsla(${h}, ${s}%, ${l}%, 0))
    `;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      if (
        this._isDraggingHueSliderMarker === false &&
        this._isDraggingSaturationSliderMarker === false &&
        this._isDraggingLightnessSliderMarker === false &&
        this._isDraggingAlphaSliderMarker === false
      ) {
        let [h, s, l, a] = parseColor(this.value, "hsla");

        this._h = h;
        this._s = s;
        this._l = l;
        this._a = a;

        this._update();
      }
    }

    _onHueSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#hue-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingHueSliderMarker = true;
      this["#hue-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let h = ((clientX - trackBounds.x) / trackBounds.width) * 360;
        h = normalize(h, 0, 360, 0);

        if (h !== this._h) {
          this._h = h;
          this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

          this._updateHueSliderMarker();
          this._udpateSaturationSliderBackground();
          this._udpateLightnessSliderBackground();
          this._updateAlphaSliderBackground();

          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#hue-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#hue-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#hue-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#hue-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

        this._isDraggingHueSliderMarker = false;
      });
    }

    _onSaturationSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#saturation-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingSaturationSliderMarker = true;
      this["#saturation-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let s = ((clientX - trackBounds.x) / trackBounds.width) * 100;
        s = normalize(s, 0, 100, 0);

        if (s !== this._s) {
          this._s = s;
          this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

          this._udpateSaturationSliderMarker();
          this._udpateSaturationSliderBackground();
          this._udpateLightnessSliderBackground();
          this._updateAlphaSliderBackground();

          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#saturation-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#saturation-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#saturation-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#saturation-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

        this._isDraggingSaturationSliderMarker = false;
      });
    }

    _onLightnessSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#lightness-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingLightnessSliderMarker = true;
      this["#lightness-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let l = ((clientX - trackBounds.x) / trackBounds.width) * 100;
        l = normalize(l, 0, 100, 0);

        if (l !== this._l) {
          this._l = l;
          this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");

          this._udpateLightnessSliderMarker();
          this._udpateSaturationSliderBackground();
          this._udpateLightnessSliderBackground();
          this._updateAlphaSliderBackground();

          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#lightness-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#lightness-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#lightness-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#lightness-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

        this._isDraggingLightnessSliderMarker = false;
      });
    }

    _onAlphaSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#alpha-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingAlphaSliderMarker = true;
      this["#alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let a = 1 - ((clientX - trackBounds.x) / trackBounds.width);
        a = normalize(a, 0, 1, 2);

        if (a !== this._a) {
          this._a = a;
          this.value = serializeColor([this._h, this._s, this._l, this._a], "hsla", "hsla");
          this._updateAlphaSliderMarker();
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#alpha-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#alpha-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

        this._isDraggingAlphaSliderMarker = false;
      });
    }
  }
  customElements.define("x-barscolorpicker", XBarsColorPickerElement);

  let shadowTemplate$2 = html`
  <template>
    <style>
      :host {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
      :host([vertical]) {
        flex-flow: column;
        align-items: flex-start;
        justify-content: center;
      }
      :host([hidden]) {
        display: none;
      }
    </style>

    <slot></slot>
  </template>
`;

  class XBoxElement extends HTMLElement {
    // @info
    //   Whether to use vertical (rather than horizontal) layout.
    // @type
    //   boolean
    // @default
    //   false
    get vertical() {
      return this.hasAttribute("vertical");
    }
    set vertical(vertical) {
      vertical ? this.setAttribute("vertical", "") : this.removeAttribute("vertical");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$2.content, true));
    }
  }

  customElements.define("x-box", XBoxElement);

  // @copyright
  //   © 2016-2017 Jarosław Foksa

  // @info
  //   Sleep for given period of time (in miliseconds).
  // @type
  //   (number) => Promise
  let sleep = (time) => {
    return new Promise( (resolve, reject) => {
      setTimeout(() => resolve(), time);
    });
  };

  // @info
  //   Get timestamp in Unix format, e.g. 1348271383119 [http://en.wikipedia.org/wiki/Unix_time]
  // @type
  //   () => number
  let getTimeStamp = () => {
    return Date.now();
  };

  // @info
  //   Returns a function, that, when invoked, will only be triggered at most once during a given window of time.
  // @src
  //   [https://github.com/documentcloud/underscore/blob/master/underscore.js#L627]
  // @license
  //   MIT License [https://github.com/documentcloud/underscore/blob/master/LICENSE]
  // @type
  //   (Function, number, Object) => Function
  let throttle = (func, wait = 500, context) => {
    let args = null;
    let timeout = null;
    let result = null;
    let previous = 0;

    let later = () => {
      previous = new Date();
      timeout = null;
      result = func.apply(context, args);
    };

    let wrapper = (..._args) => {
      let now = new Date();
      let remaining = wait - (now - previous);
      args = _args;

      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
      }

      else if (!timeout) {
        timeout = setTimeout(later, remaining);
      }

      return result;
    };

    return wrapper;
  };

  // @info
  //   Returns a function, that, as long as it continues to be invoked, will not be triggered. The function will be
  //   called after it stops being called for N milliseconds. If `immediate` is passed, trigger the function on the
  //   leading edge, instead of the trailing.
  //   Check [http://drupalmotion.com/article/debounce-and-throttle-visual-explanation] for a nice explanation of how
  //   this is different from throttle.
  // @src
  //   [https://github.com/documentcloud/underscore/blob/master/underscore.js#L656]
  // @license
  //   MIT License [https://github.com/documentcloud/underscore/blob/master/LICENSE]
  // @type
  //   (Function, number, Object, boolean) => Function
  let debounce = (func, wait, context, immediate = false) => {
    let timeout = null;
    let result = null;

    let wrapper = (...args) => {
      let later = () => {
        timeout = null;

        if (!immediate) {
          result = func.apply(context, args);
        }
      };

      let callNow = (immediate && !timeout);
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);

      if (callNow) {
        result = func.apply(context, args);
      }

      return result;
    };

    return wrapper;
  };

  let {max: max$3} = Math;
  let easing$1 = "cubic-bezier(0.4, 0, 0.2, 1)";
  let $oldTabIndex = Symbol();

  let shadowTemplate$3 = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        height: fit-content;
        box-sizing: border-box;
        opacity: 1;
        position: relative;
        --trigger-effect: none; /* ripple, unbounded-ripple, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.2;
        --arrow-width: 8px;
        --arrow-height: 8px;
        --arrow-margin: 0 0 0 3px;
        --arrow-d: path("M 11.7 19.9 L 49.8 57.9 L 87.9 19.9 L 99.7 31.6 L 49.8 81.4 L -0.0 31.6 Z");
      }
      :host(:focus) {
        outline: none;
      }
      :host([mixed]) {
        opacity: 0.75;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      /**
       * Arrow
       */

      #arrow {
        width: var(--arrow-width);
        height: var(--arrow-height);
        min-width: var(--arrow-width);
        margin: var(--arrow-margin);
        color: currentColor;
        d: var(--arrow-d);
      }

      #arrow path {
        fill: currentColor;
        d: inherit;
      }
      #arrow[hidden] {
        display: none;
      }

      /**
       * Ripples
       */

      #ripples {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        border-radius: inherit;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 200px;
        height: 200px;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        transform: none;
        transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: opacity, transform;
        pointer-events: none;
      }
    </style>

    <div id="ripples"></div>
    <slot></slot>

    <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="arrow-path"></path>
    </svg>
  </template>
`;

  // @events
  //   toggle
  class XButtonElement extends HTMLElement {
    static get observedAttributes() {
      return ["disabled"];
    }

    // @info
    //   Values associated with this button.
    // @type
    //   string
    // @default
    //   null
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @info
    //   Whether this button is toggled.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get toggled() {
      return this.hasAttribute("toggled");
    }
    set toggled(toggled) {
      toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
    }

    // @info
    //   Whether this button can be toggled on/off by the user (e.g. by clicking the button).
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get togglable() {
      return this.hasAttribute("togglable");
    }
    set togglable(togglable) {
      togglable ? this.setAttribute("togglable", "") : this.removeAttribute("togglable");
    }

    // @info
    //   CSS skin to be used by this button.
    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get skin() {
      return this.getAttribute("skin");
    }
    set skin(skin) {
      skin === null ? this.removeAttribute("skin") : this.setAttribute("skin", skin);
    }

    // @info
    //   Whether the this button has "mixed" state.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @info
    //   Whether this button is disabled.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    // @info
    //   Whether the menu or popover associated with this button is opened.
    // @type
    //   boolean
    // @attribute
    //   read-only
    get expanded() {
      return this.hasAttribute("expanded");
    }

    // @info
    //   Whether clicking this button will cause a menu or popover to show up.
    // @type
    //   boolean
    get expandable() {
      return this._canOpenMenu() || this._canOpenPopover();
    }

    // @info
    //   Direct ancestor <x-buttons> element.
    // @type
    //   XButtonsElement?
    get ownerButtons() {
      if (this.parentElement) {
        if (this.parentElement.localName === "x-buttons") {
          return this.parentElement;
        }
        else if (this.parentElement.localName === "x-box" && this.parentElement.parentElement) {
          if (this.parentElement.parentElement.localName === "x-buttons") {
            return this.parentElement.parentElement;
          }
        }
      }

      return null;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$3.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));

      (async () => {
        await customElements.whenDefined("x-backdrop");
        this["#backdrop"] = createElement("x-backdrop");
        this["#backdrop"].style.background =  "rgba(0, 0, 0, 0)";
      })();

    }

    async connectedCallback() {
      // Make the parent anchor element non-focusable (button should be focused instead)
      if (this.parentElement && this.parentElement.localName === "a" && this.parentElement.tabIndex !== -1) {
        this.parentElement.tabIndex = -1;
      }

      this._updateAccessabilityAttributes();
      this._updateArrowVisibility();
    }

    attributeChangedCallback(name) {
      if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Open the child menu or overlay.
    expand() {
      return new Promise( async (resolve) => {
        if (this._canOpenMenu()) {
          await this._openMenu();
        }

        else if (this._canOpenPopover()) {
          await this._openPopover();
        }

        resolve();
      });
    }

    // @info
    //   Close the child menu or overlay.
    collapse(delay = null) {
      return new Promise(async (resolve) => {

        if (this._canCloseMenu()) {
          await this._closeMenu(delay);
        }
        else if (this._canClosePopover()) {
          await this._closePopover(delay);
        }

        resolve();
      });
    }

    _openMenu() {
      return new Promise( async (resolve) => {
        if (this._canOpenMenu()) {
          let menu = this.querySelector(":scope > x-menu");

          this._wasFocusedBeforeExpanding = this.matches(":focus");
          this.setAttribute("expanded", "");

          this["#backdrop"].ownerElement = menu;
          this["#backdrop"].show(false);

          await menu.openNextToElement(this, "vertical", 3);
          menu.focus();
        }

        resolve();
      });
    }

    _closeMenu(delay = null) {
      return new Promise( async (resolve) => {
        if (this._canCloseMenu()) {
          let menu = this.querySelector(":scope > x-menu");
          menu.setAttribute("closing", "");

          await delay;
          await menu.close();

          this["#backdrop"].hide(false);
          this.removeAttribute("expanded");

          if (this._wasFocusedBeforeExpanding) {
            this.focus();
          }
          else {
            let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

            if (ancestorFocusableElement) {
              ancestorFocusableElement.focus();
            }
          }

          menu.removeAttribute("closing");
        }

        resolve();
      });
    }

    _canOpenMenu() {
      let result = false;

      if (this.disabled === false) {
        let menu = this.querySelector(":scope > x-menu");

        if (menu && menu.hasAttribute("opened") === false && menu.hasAttribute("closing") === false) {
          let item = menu.querySelector("x-menuitem");

          if (item !== null) {
            result = true;
          }
        }
      }

      return result;
    }

    _canCloseMenu() {
      let result = false;

      if (this.disabled === false) {
        let menu = this.querySelector(":scope > x-menu");

        if (menu && menu.opened) {
          result = true;
        }
      }

      return result;
    }

    _openPopover() {
      return new Promise( async (resolve) => {
        if (this._canOpenPopover()) {
          let popover = this.querySelector(":scope > x-popover");

          this._wasFocusedBeforeExpanding = this.matches(":focus");
          this.setAttribute("expanded", "");

          await popover.open(this);
        }

        resolve();
      });
    }

    _closePopover(delay = null) {
      return new Promise( async (resolve) => {
        if (this._canClosePopover()) {
          let popover = this.querySelector(":scope > x-popover");
          popover.setAttribute("closing", "");

          await delay;
          await popover.close();

          this.removeAttribute("expanded");

          if (this._wasFocusedBeforeExpanding) {
            this.focus();
          }
          else {
            let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

            if (ancestorFocusableElement) {
              ancestorFocusableElement.focus();
            }
          }

          popover.removeAttribute("closing");
        }

        resolve();
      });
    }

    _canOpenPopover() {
      let result = false;

      if (this.disabled === false) {
        let popover = this.querySelector(":scope > x-popover");

        if (popover && popover.hasAttribute("opened") === false ) {
          result = true;
        }
      }

      return result;
    }

    _canClosePopover() {
      let result = false;

      if (this.disabled === false) {
        let popover = this.querySelector(":scope > x-popover");

        if (popover && popover.opened) {
          result = true;
        }
      }

      return result;
    }

    _openDialog() {
      return new Promise((resolve) => {
        if (this._canOpenDialog()) {
          let dialog = this.querySelector(":scope > dialog");
          dialog.showModal();
        }

        resolve();
      });
    }

    _canOpenDialog() {
      let result = false;

      if (this.disabled === false) {
        let dialog = this.querySelector(":scope > dialog");

        if (dialog && dialog.hasAttribute("open") === false && dialog.hasAttribute("closing") === false) {
          result = true;
        }
      }

      return result;
    }

    _openNotification() {
      return new Promise((resolve) => {
        if (this._canOpenNotification()) {
          let notification = this.querySelector(":scope > x-notification");
          notification.opened = true;
        }

        resolve();
      });
    }

    _canOpenNotification() {
      let result = false;

      if (this.disabled === false) {
        let notification = this.querySelector(":scope > x-notification");

        if (notification && !notification.hasAttribute("opened") && !notification.hasAttribute("closing")) {
          result = true;
        }
      }

      return result;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateArrowVisibility() {
      let popup = this.querySelector(":scope > x-menu, :scope > x-popover");
      this["#arrow"].style.display = (popup ? null : "none");
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "button");
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex] > 0) ? this[$oldTabIndex] : 0;
        }

        delete this[$oldTabIndex];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    _onPointerDown(event) {
      let openedMenu = this.querySelector(":scope > x-menu[opened]");
      let openedPopover = this.querySelector(":scope > x-popover[opened]");
      let openedDialog = this.querySelector(":scope > dialog[open]");
      let openedNotification = this.querySelector(":scope > x-notification[opened]");

      this._lastPointerDownEvent = event;

      if (event.target === this["#backdrop"]) {
        this._onBackdropPointerDown(event);
      }
      else if (openedMenu && openedMenu.contains(event.target)) {
        return;
      }
      else if (openedPopover && openedPopover.contains(event.target)) {
        return;
      }
      else if (openedDialog && openedDialog.contains(event.target)) {
        return;
      }
      else if (openedNotification && openedNotification.contains(event.target)) {
        return;
      }
      else {
        this._onButtonPointerDown(event);
      }
    }

    _onClick(event) {
      let openedMenu = this.querySelector(":scope > x-menu[opened]");
      let openedPopover = this.querySelector(":scope > x-popover[opened]");
      let openedDialog = this.querySelector(":scope > dialog[open]");
      let openedNotification = this.querySelector(":scope > x-notification[opened]");

      if (event.target === this["#backdrop"]) {
        return;
      }
      else if (openedMenu && openedMenu.contains(event.target)) {
        if (openedMenu.hasAttribute("closing") === false && event.target.closest("x-menuitem")) {
          this._onMenuItemClick(event);
        }
      }
      else if (openedPopover && openedPopover.contains(event.target)) {
        return;
      }
      else if (openedDialog && openedDialog.contains(event.target)) {
        return;
      }
      else if (openedNotification && openedNotification.contains(event.target)) {
        return;
      }
      else {
        this._onButtonClick(event);
      }
    }

    _onBackdropPointerDown(pointerDownEvent) {
      this.collapse();
    }

    async _onButtonPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        pointerDownEvent.preventDefault();
        return;
      }

      if (this.querySelector(":scope > dialog[open]")) {
        pointerDownEvent.preventDefault();
        return;
      }

      // This check is needed in case a slotted element was hit
      if (this.contains(pointerDownEvent.target) === false) {
        return;
      }

      this.setPointerCapture(pointerDownEvent.pointerId);

      // Don't focus the widget with pointer, instead focus the closest ancestor focusable element as soon as
      // the button is released.
      {
        pointerDownEvent.preventDefault();

        if (this.matches(":focus") === false) {
          let ancestorFocusableElement = closest(this.parentNode, "*[tabindex]:not(a)");

          this.addEventListener("lostpointercapture", () => {
            if (ancestorFocusableElement) {
              ancestorFocusableElement.focus();
            }
            else {
              this.blur();
            }
          }, {once: true});
        }
      }

      // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
      // to last at least 150ms.
      if (this._canOpenMenu() === false && this._canOpenPopover() === false && this._canClosePopover() === false) {
        let pointerDownTimeStamp = Date.now();
        let isDown = true;

        this.addEventListener("lostpointercapture", async () => {
          isDown = false;
          let pressedTime = Date.now() - pointerDownTimeStamp;
          let minPressedTime = (pointerDownEvent.pointerType === "touch") ? 600 : 150;

          if (pressedTime < minPressedTime) {
            await sleep(minPressedTime - pressedTime);
          }

          this.removeAttribute("pressed");
        }, {once: true});

        (async () => {
          if (this.ownerButtons) {
            if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2) {
              await sleep(10);
            }
            else if (this.ownerButtons.tracking === 1 && (this.toggled === false || this.mixed)) {
              await sleep(10);
            }
            else if (this.ownerButtons.tracking === 3) {
              let buttons = [...this.ownerButtons.querySelectorAll(":scope > x-button, :scope > x-box > x-button")];
              let toggledButtons = buttons.filter(button => button.toggled);

              if (this.toggled === false || toggledButtons.length > 1 ) {
                await sleep(10);
              }
            }
          }
          else if (this.togglable) {
            await sleep(10);
          }

          if (isDown) {
            this.setAttribute("pressed", "");
          }
        })();
      }

      if (this._canOpenMenu()) {
        if (pointerDownEvent.pointerType !== "touch") {
          this._openMenu();
        }
      }
      else if (this._canOpenPopover()) {
        if (pointerDownEvent.pointerType !== "touch") {
          this._openPopover();
        }
      }
      else if (this._canClosePopover()) {
        this._closePopover();
      }

      // Ripple
      {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        if (triggerEffect === "ripple") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max$3(rect.width, rect.height) * 1.5;
          let top  = pointerDownEvent.clientY - rect.y - size/2;
          let left = pointerDownEvent.clientX - rect.x - size/2;
          let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));
          let delay = true;

          if (this.expandable === false) {
            if (this.ownerButtons) {
              if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2) {
                delay = false;
              }
              else if (this.ownerButtons.tracking === 1 && this.toggled === false) {
                delay = false;
              }
              else if (this.ownerButtons.tracking === 3) {
                let buttons = [...this.ownerButtons.querySelectorAll(":scope > x-button, :scope > x-box > x-button")];
                let toggledButtons = buttons.filter(button => button.toggled);

                if (this.toggled === false || toggledButtons.length > 1 ) {
                  delay = false;
                }
              }

            }
            else if (this.togglable) {
              delay = false;
            }
          }

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple pointer-down-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

          this["#ripples"].append(ripple);
          this["#ripples"].style.contain = "strict";

          let inAnimation = ripple.animate(
            { transform: ["scale3d(0, 0, 0)", "none"]},
            { duration: 300, easing: easing$1 }
          );

          await whenLostPointerCapture;

          if (delay) {
            await inAnimation.finished;

            let outAnimation = ripple.animate(
              { opacity: [getComputedStyle(ripple).opacity || "0", "0"]},
              { duration: 300, easing: easing$1 }
            );

            await outAnimation.finished;
          }

          ripple.remove();
        }

        else if (triggerEffect === "unbounded-ripple") {
          let bounds = this["#ripples"].getBoundingClientRect();
          let size = bounds.height * 1.25;
          let top  = (bounds.y + bounds.height/2) - bounds.y - size/2;
          let left = (bounds.x + bounds.width/2)  - bounds.x - size/2;
          let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple pointer-down-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

          this["#ripples"].append(ripple);
          this["#ripples"].style.contain = "none";

          // Workaround for buttons that change their color when toggled on/off.
          ripple.hidden = true;
          await sleep(20);
          ripple.hidden = false;

          let inAnimation = ripple.animate(
            { transform: ["scale(0)", "scale(1)"] },
            { duration: 200, easing: easing$1 }
          );

          await whenLostPointerCapture;
          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
            { duration: 200, easing: easing$1 }
          );

          await outAnimation.finished;
          ripple.remove();
        }
      }
    }

    async _onButtonClick(event) {
      let popup = this.querySelector(":scope > x-menu, :scope > x-popover");

      if (popup) {
        if (popup.hasAttribute("closing")) {
          return;
        }
        else {
          popup.focus();
        }
      }

      if (this._canClosePopover() === false) {
        if (this._canOpenDialog()) {
          this._openDialog();
        }
        else if (this._canOpenNotification()) {
          this._openNotification();
        }
      }

      if (this._lastPointerDownEvent && this._lastPointerDownEvent.pointerType === "touch") {
        if (this._canOpenMenu()) {
          this._openMenu();
        }
        else if (this._canOpenPopover()) {
          this._openPopover();
        }
      }

      // Toggle the button
      if (this.togglable && event.defaultPrevented === false) {
        this.removeAttribute("pressed");
        this.toggled = !this.toggled;
        this.dispatchEvent(new CustomEvent("toggle"));
      }

      // Ripple
      if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        if (triggerEffect === "ripple") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max$3(rect.width, rect.height) * 1.5;
          let top  = (rect.y + rect.height/2) - rect.y - size/2;
          let left = (rect.x + rect.width/2) - rect.x - size/2;
          let delay = true;

          if (this.ownerButtons) {
            if (this.ownerButtons.tracking === 0 || this.ownerButtons.tracking === 2 || this.ownerButtons.tracking === 3) {
              delay = false;
            }
            else if (this.ownerButtons.tracking === 1 && this.toggled === true) {
              delay = false;
            }
          }
          else if (this.togglable) {
            delay = false;
          }

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple click-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

          this["#ripples"].append(ripple);
          this["#ripples"].style.contain = "strict";

          let inAnimation = ripple.animate(
            { transform: ["scale3d(0, 0, 0)", "none"]},
            { duration: 300, easing: easing$1 }
          );

          if (delay) {
            await inAnimation.finished;

            let outAnimation = ripple.animate(
              { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
              { duration: 300, easing: easing$1 }
            );

            await outAnimation.finished;
          }

          ripple.remove();
        }

        else if (triggerEffect === "unbounded-ripple") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = rect.height * 1.35;
          let top  = (rect.y + rect.height/2) - rect.y - size/2;
          let left = (rect.x + rect.width/2) - rect.x - size/2;

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

          this["#ripples"].append(ripple);
          this["#ripples"].style.contain = "none";

          await ripple.animate(
            { transform: ["scale3d(0, 0, 0)", "none"] },
            { duration: 300, easing: easing$1 }
          ).finished;

          await ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity || "0", "0"] },
            { duration: 300, easing: easing$1 }
          ).finished;

          ripple.remove();
        }
      }
    }

    _onMenuItemClick(event) {
      let item = event.target.closest("x-menuitem");
      let menu = this.querySelector(":scope > x-menu");

      if (!menu.hasAttribute("closing")) {
        this.collapse(item.whenTriggerEnd);
      }
    }

    _onKeyDown(event) {
      if (event.defaultPrevented === false) {
        if (event.code === "Enter" || event.code === "Space") {
          if (this._canOpenMenu()) {
            event.preventDefault();
            this._openMenu().then(() => this.querySelector(":scope > x-menu").focusFirstMenuItem());
          }
          else if (this._canOpenPopover()) {
            event.preventDefault();
            this._openPopover();
          }
          else if (this._canOpenDialog()) {
            event.preventDefault();
            this._openDialog();
          }
          else if (this._canOpenNotification()) {
            event.preventDefault();
            this._openNotification();
          }
          else {
            if (this.matches(":focus")) {
              if (this._canClosePopover()) {
                this._closePopover();
              }
              else if (this._canCloseMenu()) {
                this._closeMenu();
              }
              else {
                event.preventDefault();
                this.click();
              }
            }
          }
        }

        else if (event.code === "ArrowDown") {
          if (this._canOpenMenu()) {
            let menu = this.querySelector(":scope > x-menu");
            event.preventDefault();
            this._openMenu().then(() => this.querySelector(":scope > x-menu").focusFirstMenuItem());
          }
          else if (this._canOpenPopover()) {
            event.preventDefault();
            this._openPopover();
          }
          else {
            event.preventDefault();
            this.click();
          }
        }

        else if (event.code === "ArrowUp") {
          if (this._canOpenMenu()) {
            event.preventDefault();
            this._openMenu().then(() => this.querySelector(":scope > x-menu").focusLastMenuItem());
          }
          else if (this._canOpenPopover()) {
            event.preventDefault();
            this._openPopover();
          }
          else {
            event.preventDefault();
            this.click();
          }
        }

        else if (event.code === "Escape") {
          if (this._canCloseMenu()) {
            event.preventDefault();
            this.collapse();
          }
          else if (this._canClosePopover()) {
            event.preventDefault();
            this.collapse();
          }
        }
      }
    }
  }

  customElements.define("x-button", XButtonElement);

  let {isArray} = Array;

  let shadowTemplate$4 = html`
  <template>
    <style>
      :host {
        display: flex;
        flex-flow: row;
        align-items: center;
        justify-content: flex-start;
        box-sizing: border-box;
        width: fit-content;
      }
      :host([hidden]) {
        display: none;
      }
    </style>
    <slot></slot>
  </template>
`;

  // @events
  //   toggle
  class XButtonsElement extends HTMLElement {
    // @info
    //  Specifies what should happen when user clicks a button:
    //  -1 - Do not toggle any buttons
    //   0 - Toggle the clicked button on/off and other buttons off
    //   1 - Toggle the clicked button on and other buttons off
    //   2 - Toggle the clicked button on/off
    //   3 - Toggle the clicked button on/off, but toggle off only if there is at least one other button toggled on
    // @type
    //   number
    // @default
    //   -1
    // @attribute
    get tracking() {
      return this.hasAttribute("tracking") ? parseInt(this.getAttribute("tracking")) : -1;
    }
    set tracking(tracking) {
      this.setAttribute("tracking", tracking);
    }

    // @info
    //   Get/set the buttons that should have toggled state.
    // @type
    //   string || Array || null
    get value() {
      if (this.tracking === 2 || this.tracking === 3) {
        let buttons = this._getButtons().filter(button => button.toggled);
        return buttons.map(button => button.value).filter(value => value != undefined);
      }
      else if (this.tracking === 1 || this.tracking === 0) {
        let button = this._getButtons().find(button => button.toggled);
        return button && button.value !== undefined ? button.value : null;
      }
      else if (this.tracking === -1) {
        return null;
      }
    }
    set value(value) {
      if (this.tracking === 2 || this.tracking === 3) {
        let buttons = this._getButtons();

        if (isArray(value)) {
          for (let button of buttons) {
            button.toggled = (value.includes(button.value));
          }
        }
        else {
          for (let button of buttons) {
            button.toggled = button.value === value;
          }
        }
      }
      else if (this.tracking === 1 || this.tracking === 0) {
        let buttons = this._getButtons();
        let matchedButton = buttons.find(button => button.value === value);

        for (let button of buttons) {
          button.toggled = (button === matchedButton);
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$4.content, true));

      this.addEventListener("click", (event) => this._onClick(event), true);
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      for (let child of this.children) {
        if (child.localName === "x-button") {
          let boxShadow = getComputedStyle(child).boxShadow;

          if (boxShadow !== "none") {
            this.setAttribute("hasboxshadow", "");
          }
          else {
            this.removeAttribute("hasboxshadow");
          }

          break;
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _getButtons() {
      return [...this.querySelectorAll(":scope > x-button, :scope > x-box > x-button")];
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onClick(event) {
      if (event.button !== 0) {
        return;
      }

      let clickedButton = event.target.closest("x-button");
      let canToggle = (clickedButton && clickedButton.disabled === false && clickedButton.expandable === false);

      if (canToggle) {
        let otherButtons = this._getButtons().filter(button => button !== clickedButton);

        if (this.tracking === 0) {
          if (clickedButton.mixed) {
            clickedButton.mixed = false;
          }
          else {
            clickedButton.toggled = !clickedButton.toggled;
            clickedButton.mixed = false;
          }

          for (let button of otherButtons) {
            button.toggled = false;
            button.mixed = false;
          }

          this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
        }
        else if (this.tracking === 1) {
          if (clickedButton.toggled === false || clickedButton.mixed === true) {
            clickedButton.toggled = true;
            clickedButton.mixed = false;

            for (let button of otherButtons) {
              button.toggled = false;
              button.mixed = false;
            }

            this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
          }
        }
        else if (this.tracking === 2) {
          if (clickedButton.mixed) {
            clickedButton.mixed = false;
          }
          else {
            clickedButton.toggled = !clickedButton.toggled;
          }

          this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
        }
        else if (this.tracking === 3) {
          let otherToggledButtons = otherButtons.filter(button => button.toggled === true);

          if (clickedButton.toggled === false || otherToggledButtons.length > 0) {
            if (clickedButton.mixed) {
              clickedButton.mixed = false;
            }
            else {
              clickedButton.toggled = !clickedButton.toggled;
            }

            this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedButton}));
          }
        }
      }
    }

    _onKeyDown(event) {
      let {key} = event;

      if (key === "ArrowRight") {
        let element = [...this.children].find(child => child.matches(":focus"));

        if (element) {
          if (element.nextElementSibling) {
            element.nextElementSibling.focus();
          }
          else if (element !== element.parentElement.firstElementChild) {
            element.parentElement.firstElementChild.focus();
          }
        }
      }

      else if (key === "ArrowLeft") {
        let element = [...this.children].find(child => child.matches(":focus"));

        if (element) {
          if (element.previousElementSibling) {
            element.previousElementSibling.focus();
          }
          else if (element !== element.parentElement.lastElementChild) {
            element.parentElement.lastElementChild.focus();
          }
        }
      }
    }
  }

  customElements.define("x-buttons", XButtonsElement);

  let shadowTemplate$5 = html`
  <template>
    <style>
      :host {
        display: block;
        width: 100%;
        min-width: 20px;
        min-height: 48px;
        box-sizing: border-box;
        margin: 30px 0;
      }
    </style>
    <slot></slot>
  </template>
`;

  class XCardElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$5.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }
  }

  customElements.define("x-card", XCardElement);

  let easing$2 = "cubic-bezier(0.4, 0, 0.2, 1)";
  let $oldTabIndex$1 = Symbol();

  let shadowTemplate$6 = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        margin: 0 8px 0 0;
        width: 24px;
        height: 24px;
        box-sizing: border-box;
        border: 2px solid currentColor;
        --checkmark-width: 100%;
        --checkmark-height: 100%;
        --checkmark-opacity: 0;
        --checkmark-d: path(
          "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z M 95 23 L 86 13 L 37 66 L 13.6 41 L 4.5 51 L 37 85 L 95 23 Z"
        );
        --ripple-type: none; /* unbounded, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.15;
      }
      :host([toggled]) {
        --checkmark-opacity: 1;
      }
      :host([mixed]) {
        --checkmark-opacity: 1;
        --checkmark-d: path("M 0 0 L 100 0 L 100 100 L 0 100 Z M 87 42.6 L 13 42.6 L 13 57.4 L 87 57.4 Z");
      }
      :host([disabled]) {
        opacity: 0.4;
        pointer-events: none;
      }
      :host([hidden]) {
        display: none;
      }
      :host(:focus) {
        outline: none;
      }

      /**
       * Icons
       */

      #checkmark {
        position: absolute;
        top: 0;
        left: 0;
        width: var(--checkmark-width);
        height: var(--checkmark-height);
        opacity: var(--checkmark-opacity);
        d: var(--checkmark-d);
        transition-property: opacity;
        transition-timing-function: inherit;
        transition-duration: inherit;
      }

      #checkmark path {
        fill: currentColor;
        d: inherit;
      }

      /**
       * Ripples
       */

      #ripples {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        z-index: -1;
        will-change: opacity, transform;
        border-radius: 999px;
        transform: scale(2.6);
      }
    </style>

    <div id="ripples"></div>

    <svg id="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path></path>
    </svg>
  </template>
`;

  // @events
  //   toggle
  class XCheckboxElement extends HTMLElement {
    static get observedAttributes() {
      return ["toggled", "disabled"];
    }

    // @info
    //   Values associated with this checkbox.
    // @type
    //   string
    // @default
    //   null
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get toggled() {
      return this.hasAttribute("toggled");
    }
    set toggled(toggled) {
      toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$6.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      this._updateAccessabilityAttributes();
    }

    attributeChangedCallback(name) {
      if (name === "toggled") {
        this._onToggledAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "checkbox");
      this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$1] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$1] > 0) ? this[$oldTabIndex$1] : 0;
        }

        delete this[$oldTabIndex$1];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onToggledAttributeChange() {
      this.setAttribute("aria-toggled", this.mixed ? "mixed" : this.toggled);
    }

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    _onPointerDown(event) {
      if (event.buttons !== 1) {
        event.preventDefault();
        return;
      }

      // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
      if (this.matches(":focus") === false) {
        event.preventDefault();

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      // Ripple
      {
        let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

        if (rippleType === "unbounded") {
          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple pointer-down-ripple");
          this["#ripples"].append(ripple);

          let transformAnimation = ripple.animate(
            { transform: ["scale(0)", "scale(2.6)"] },
            { duration: 200, easing: easing$2 }
          );

          this.setPointerCapture(event.pointerId);

          this.addEventListener("lostpointercapture", async () => {
            await transformAnimation.finished;

            let opacityAnimation = ripple.animate(
              { opacity: [getComputedStyle(ripple).opacity, "0"] },
              { duration: 200, easing: easing$2 }
            );

            await opacityAnimation.finished;

            ripple.remove();
          }, {once: true});
        }
      }
    }

    async _onClick(event) {
      // Update state
      {
        if (this.mixed) {
          this.mixed = false;
        }
        else {
          this.toggled = !this.toggled;
        }

        this.dispatchEvent(new CustomEvent("toggle", {bubbles: true}));
      }

      // Ripple
      if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
        let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

        if (rippleType === "unbounded") {
          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple");
          this["#ripples"].append(ripple);

          await ripple.animate(
            { transform: ["scale(0)", "scale(2.6)"] },
            { duration: 300, easing: easing$2 }
          ).finished;

          await ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"] },
            { duration: 300, easing: easing$2 }
          ).finished;

          ripple.remove();
        }
      }
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        this.click();
      }
    }
  }
  customElements.define("x-checkbox", XCheckboxElement);

  let $oldTabIndex$2 = Symbol();

  let shadowHTML$1 = `
  <style>
    :host {
      display: block;
      height: 24px;
      width: 40px;
      box-sizing: border-box;
      border: 1px solid rgb(150, 150, 150);
      position: relative;
      /* Checkerboard pattern */
      background-color: white;
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
      background-image: linear-gradient(45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(-45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #d6d6d6 75%),
                        linear-gradient(-45deg, transparent 75%, #d6d6d6 75%);
    }
    :host([hidden]) {
      display: none;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.4;
    }

    ::slotted(x-popover) {
      width: 190px;
      height: auto;
      padding: 12px 12px;
    }

    #input {
      display: flex;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      border: none;
      background: none;
      padding: 0;
      opacity: 0;
      -webkit-appearance: none;
    }
    #input::-webkit-color-swatch-wrapper {
      padding: 0;
    }
    #input::-webkit-color-swatch {
      border: none;
    }
  </style>

  <input tabindex="-1" id="input" type="color" value="#ffffff">
  <slot></slot>
`;

  // @events
  //   change
  //   changestart
  //   changeend
  class XColorSelectElement extends HTMLElement {
    static get observedAttributes() {
      return ["value", "disabled"];
    }

    // @type
    //   string
    // @default
    //   #000000
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : "#ffffff";
    }
    set value(value) {
      this.setAttribute("value", value);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._inputChangeStarted = false;
      this._onInputChangeDebouonced = debounce(this._onInputChangeDebouonced, 400, this);

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.innerHTML = shadowHTML$1;

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("change", (event) => this._onChange(event));
      this["#input"].addEventListener("change", (event) => this._onInputChange(event));
    }

    attributeChangedCallback(name) {
      if (name === "value") {
        this._onValueAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    connectedCallback() {
      let picker = this.querySelector("x-wheelcolorpicker, x-rectcolorpicker, x-barscolorpicker");

      if (picker) {
        picker.setAttribute("value", formatColorString(this.value, "rgba"));
      }

      this._updateAccessabilityAttributes();
      this._updateInput();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async _expand() {
      if (this.hasAttribute("expanded") === false) {
        let popover = this.querySelector("x-popover");

        if (popover) {
          this._wasFocusedBeforeExpanding = this.matches(":focus");
          this.setAttribute("expanded", "");
          await popover.open(this);
          popover.focus();
        }
      }
    }

    async _collapse(delay = null) {
      if (this.hasAttribute("expanded")) {
        let popover = this.querySelector("x-popover");

        if (popover) {
          popover.setAttribute("closing", "");

          await popover.close();
          this.removeAttribute("expanded");

          if (this._wasFocusedBeforeExpanding) {
            this.focus();
          }
          else {
            let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

            if (ancestorFocusableElement) {
              ancestorFocusableElement.focus();
            }
          }

          popover.removeAttribute("closing");
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateInput() {
      let [r, g, b, a] = parseColor(this.value, "rgba");
      this["#input"].value = serializeColor([r, g, b, a], "rgba", "hex");
      this["#input"].style.opacity = a;
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$2] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$2] > 0) ? this[$oldTabIndex$2] : 0;
        }

        delete this[$oldTabIndex$2];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      if (!this._inputChangeStarted) {
        this._updateInput();
      }

      let picker = [...this.querySelectorAll("*")].find(element => element.localName.endsWith("colorpicker"));

      if (picker && picker.getAttribute("value") !== this.getAttribute("value")) {
        picker.setAttribute("value", this.getAttribute("value"));
      }
    }

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    _onChange(event) {
      if (event.target !== this) {
        this.value = formatColorString(event.target.value, "rgba");
        this._updateInput();
      }
    }

    _onInputChange() {
      if (this._inputChangeStarted === false) {
        this._inputChangeStarted = true;
        this.dispatchEvent(new CustomEvent("changestart"));
      }

      this.value = this["#input"].value;
      this.dispatchEvent(new CustomEvent("change"));
      this._onInputChangeDebouonced();
    }

    _onInputChangeDebouonced() {
      if (this._inputChangeStarted) {
        this._inputChangeStarted = false;

        this.value = this["#input"].value;
        this.dispatchEvent(new CustomEvent("changeend"));
      }
    }

    _onPointerDown(event) {
      if (event.target === this) {
        event.preventDefault();
      }
    }

    _onClick(event) {
      let popover = this.querySelector(":scope > x-popover");

      if (popover) {
        if (popover.opened) {
          if (popover.modal === false && event.target === this) {
            event.preventDefault();
            this._collapse();
          }
          else if (popover.modal === true && event.target.localName === "x-backdrop") {
            event.preventDefault();
            this._collapse();
          }
        }
        else {
          event.preventDefault();
          this._expand();
        }
      }
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space") {
        let popover = this.querySelector("x-popover");

        event.preventDefault();
        event.stopPropagation();

        if (popover) {
          if (this.hasAttribute("expanded")) {
            this._collapse();
          }
          else {
            this._expand();
          }
        }
        else {
          this["#input"].click();
        }
      }

      else if (event.code === "Escape") {
        let popover = this.querySelector("x-popover");

        if (popover) {
          if (this.hasAttribute("expanded")) {
            event.preventDefault();
            this._collapse();
          }
        }
      }

      else if (event.code === "Tab") {
        if (this.hasAttribute("expanded")) {
          event.preventDefault();
        }
      }
    }
  }

  customElements.define("x-colorselect", XColorSelectElement);

  let shadowTemplate$7 = html`
  <template>
    <style>
      :host {
        display: block;
        position: fixed;
        width: 0px;
        height: 0px;
        z-index: 1001;
      }
    </style>

    <slot></slot>
  </template>
`;

  class XContextMenuElement extends HTMLElement {
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._parentElement = null;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$7.content, true));

      this["#backdrop"] = createElement("x-backdrop");
      this["#backdrop"].style.background =  "rgba(0, 0, 0, 0)";
      this["#backdrop"].addEventListener("contextmenu", (event) => this._onBackdropContextMenu(event));
      this["#backdrop"].addEventListener("pointerdown", (event) => this._onBackdropPointerDown(event));

      window.addEventListener("blur", (event) => this._onBlur(event));
      this.addEventListener("blur", (event) => this._onBlur(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event), true);
      this.addEventListener("click", (event) => this._onClick(event));
    }

    connectedCallback() {
      this._parentElement = this.parentElement || this.parentNode.host;

      this._parentElement.addEventListener("contextmenu", this._parentContextMenuListener = (event) => {
        this._onParentContextMenu(event);
      });
    }

    disconnectedCallback() {
      this._parentElement.removeEventListener("contextmenu", this._parentContextMenuListener);
      this._parentElement = null;
    }

    ///////////////////////////////////'/////////////////////////////////////////////////////////////////////////////

    open(clientX, clientY) {
      let menu = this.querySelector("x-menu");

      if (menu.opened === false) {
        menu.openAtPoint(clientX, clientY);

        this["#backdrop"].ownerElement = menu;
        this["#backdrop"].show(false);

        menu.focus();
      }
    }

    close() {
      return new Promise(async (resolve) => {
        let menu = this.querySelector("x-menu");
        await menu.close();
        this["#backdrop"].hide(false);

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }

        resolve();
      });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onBlur() {
    }

    _onParentContextMenu(event) {
      if (this.disabled === false) {
        event.preventDefault();
        this.open(event.clientX, event.clientY);
      }
    }

    _onBackdropContextMenu(event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      this.close().then(() => {
        let target = elementFromPoint(event.clientX, event.clientY, true);
        let clonedEvent = new MouseEvent(event.type, event);
        target.dispatchEvent(clonedEvent);
      });
    }

    _onBackdropPointerDown(event) {
      if (event.buttons === 1) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.close();
      }
    }

    async _onClick(event) {
      let item = event.target.closest("x-menuitem");

      if (item && item.disabled === false) {
        let submenu = item.querySelector("x-menu");

        if (submenu) {
          if (submenu.opened) {
            submenu.close();
          }
          else {
            submenu.openNextToElement(item, "horizontal");
          }
        }
        else {
          this.setAttribute("closing", "");

          await item.whenTriggerEnd;
          await this.close();

          this.removeAttribute("closing");
        }
      }
    }

    _onKeyDown(event) {
      if (event.key === "Escape") {
        let menu = this.querySelector("x-menu");

        if (menu.opened) {
          event.preventDefault();
          this.close();
        }
      }

      else if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();

        let menu = this.querySelector("x-menu");
        menu.focusNextMenuItem();
      }
    }
  }

  customElements.define("x-contextmenu", XContextMenuElement);

  let $oldTabIndex$3 = Symbol();

  let shadowTemplate$8 = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        max-width: 140px;
        height: 24px;
        box-sizing: border-box;
        color: #000000;
        background: white;
        --inner-padding: 0;
      }
      :host(:focus) {
        z-index: 10;
      }
      :host(:hover) {
        cursor: text;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      #main {
        display: flex;
        align-items: center;
        width: 100%;
        height: 100%;
      }

      /**
       * Input
       */

      #input {
        width: 100%;
        height: 100%;
        padding: var(--inner-padding);
        box-sizing: border-box;
        color: inherit;
        background: none;
        border: none;
        outline: none;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        text-align: inherit;
        cursor: inherit;
      }
      #input::-webkit-clear-button {
        display: none;
      }
      #input::-webkit-inner-spin-button {
        display: none;
      }
      #input::-webkit-calendar-picker-indicator {
        opacity: 0;
        margin: 0;
        padding: 0;
        width: 16px;
        height: 16px;
      }
      :host([empty]) #input::-webkit-datetime-edit-fields-wrapper {
        display: none;
      }
      :host(:active) #input::-webkit-datetime-edit-fields-wrapper,
      :host(:focus) #input::-webkit-datetime-edit-fields-wrapper {
        display: initial;
      }

      /**
       * Expand icon
       */

      #expand-icon {
        display: block;
        position: absolute;
        right: 5px;
        width: 16px;
        height: 16px;
        opacity: 0.7;
        color: inherit;
        background-color: inherit;
        pointer-events: none;
      }

      /**
       * Error message
       */

      :host([error])::before {
        position: absolute;
        left: 0;
        top: 26px;
        box-sizing: border-box;
        color: #d50000;
        font-family: inherit;
        font-size: 11px;
        line-height: 1.2;
        white-space: pre;
        content: attr(error);
      }
    </style>

    <main id="main">
      <slot></slot>
      <x-icon id="expand-icon" name="date-range"></x-icon>
      <input id="input" type="date"></input>
    </main>
  </template>
`;

  // @events
  //   input
  //   change
  //   textinputmodestart
  //   textinputmodeend
  class XDateSelectElement extends HTMLElement {
    static get observedAttributes() {
      return ["value", "min", "max", "disabled", "validation"];
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    //   partial
    get value() {
      return this["#input"].value;
    }
    set value(value) {
      if (this["#input"].value !== value) {
        this["#input"].value = value;

        if (this.validation === "instant") {
          this.validate();
        }
        else if (this.validation === "auto" || this.validation === "manual") {
          if (this.error !== null) {
            this.validate();
          }
        }

        this._updateEmptyState();
      }
    }

    // @type
    //   string
    // @default
    //   null
    // @attribute
    get min() {
      return this.hasAttribute("min") ? this.getAttribute("min") : null;
    }
    set min(date) {
      this.setAttribute("min", date);
    }

    // @type
    //   string
    // @default
    //   null
    // @attribute
    get max() {
      return this.hasAttribute("max") ? this.getAttribute("max") : null;
    }
    set max(date) {
      this.setAttribute("max", date);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get required() {
      return this.hasAttribute("required");
    }
    set required(required) {
      required ? this.setAttribute("required", "") : this.removeAttribute("required");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    // @info
    //   "auto"    - validate() is called when input loses focus and when user presses "Enter"
    //   "instant" - validate() is called on each key press
    //   "manual"  - you will call validate() manually when user submits the form
    // @type
    //   "auto" || "instant" || "manual"
    // @default
    //   "auto"
    get validation() {
      return this.hasAttribute("validation") ? this.getAttribute("validation") : "auto";
    }
    set validation(validation) {
      this.setAttribute("validation", validation);
    }

    // @type
    //   string?
    // @default
    //   null
    // @attribute
    get error() {
      return this.getAttribute("error");
    }
    set error(error) {
      error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate$8.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("focusin", (event) => this._onFocusIn(event));
      this.addEventListener("focusout", (event) => this._onFocusOut(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));

      this["#input"].addEventListener("change", (event) => this._onInputChange(event));
      this["#input"].addEventListener("input", (event) => this._onInputInput(event));
    }

    connectedCallback() {
      this._updateAccessabilityAttributes();
      this._updateEmptyState();

      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }

    attributeChangedCallback(name) {
      if (name === "value") {
        this._onValueAttributeChange();
      }
      else if (name === "min") {
        this._onMinAttributeChange();
      }
      else if (name === "max") {
        this._onMaxAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
      else if (name === "validation") {
        this._onValidationAttributeChnage();
      }
    }

    // @info
    //   Override this method to validate the input value manually.
    // @type
    //   () => void
    validate() {
      if (this.value && this.min && this.value < this.min) {
        this.error = "Entered date is before the minimum date";
      }
      else if (this.value && this.max && this.value > this.max) {
        this.error = "Entered date is after the maximum date";
      }
      else if (this.required && this.value.length === 0) {
        this.error = "This field is required";
      }
      else {
        this.error = null;
      }
    }

    selectAll() {
      this["#input"].select();
    }

    clear() {
      this.value = "";
      this.error = null;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateEmptyState() {
      if (this.value.length === 0) {
        this.setAttribute("empty", "");
      }
      else {
        this.removeAttribute("empty");
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "input");
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$3] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$3] > 0) ? this[$oldTabIndex$3] : 0;
        }

        delete this[$oldTabIndex$3];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

      if (this.matches(":focus")) {
        this.selectAll();
      }
    }

    _onMinAttributeChange() {
      this["#input"].min = this.min;
    }

    _onMaxAttributeChange() {
      this["#input"].max = this.max;
    }

    _onDisabledAttributeChange() {
      this["#input"].disabled = this.disabled;
      this._updateAccessabilityAttributes();
    }

    _onValidationAttributeChnage() {
      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }

    _onFocusIn() {
      this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
    }

    _onFocusOut() {
      this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));

      if (this.validation === "auto") {
        this.validate();
      }
    }

    _onKeyDown(event) {
      if (event.key === "Enter") {
        document.execCommand("selectAll");

        if (this.validation === "instant") {
          this.validate();
        }
        else if (this.validation === "auto" || this.validation === "manual") {
          if (this.error !== null) {
            this.validate();
          }
        }
      }
    }

    _onInputInput(event) {
      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }

      event.stopPropagation();
      this._updateEmptyState();
      this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
    }

    _onInputChange() {
      this.validate();
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
    }
  }

  customElements.define("x-dateselect", XDateSelectElement);

  let {max: max$4} = Math;

  let easing$3 = "cubic-bezier(0.4, 0, 0.2, 1)";

  let shadowTemplate$9 = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        position: relative;
        width: 100%;
        height: 100%;
        max-width: 200px;
        flex: 1 0 0;
        transition-property: max-width, padding, order;
        transition-duration: 0.15s;
        transition-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1);
        cursor: default;
        padding: 0 4px 0 16px;
        user-select: none;
        touch-action: pan-y;
        box-sizing: border-box;
        overflow: hidden;
        contain: strict;
        will-change: max-width;
        z-index: 0;
        -webkit-app-region: no-drag;
        --ripple-type: none; /* bounded, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.2;
        --selection-indicator-height: 3px;
        --selection-indicator-color: var(--accent-color);
        --close-button-position: static;
        --close-button-left: 0;
        --close-button-right: initial;
        --close-button-width: 18px;
        --close-button-height: 18px;
        --close-button-margin: 0 0 0 auto;
        --close-button-opacity: 0.8;
        --close-button-path-d: path(
          "M 74 31 L 69 26 L 50 45 L 31 26 L 26 31 L 45 50 L 26 69 L 31 74 L 50 55 L 69 74 L 74 69 L 55 50 Z"
        );
      }
      :host([edited]) {
        --close-button-path-d: path(
          "M 68 50 C 68 60 60 68 50 68 C 40 68 32 60 32 50 C 32 40 40 32 50 32 C 60 32 68 40 68 50 Z"
        );
      }
      :host(:focus) {
        outline: none;
      }
      :host([closing]) {
        pointer-events: none;
      }
      :host([selected]) {
        z-index: 1;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }

      /**
       * Close button
       */

      #close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        position: var(--close-button-position);
        left: var(--close-button-left);
        right: var(--close-button-right);
        width: var(--close-button-width);
        height: var(--close-button-height);
        margin: var(--close-button-margin);
        opacity: var(--close-button-opacity);
        padding: 1px;
      }
      #close-button:hover {
        background: rgba(0, 0, 0, 0.08);
        opacity: 1;
      }

      #close-button-path {
        pointer-events: none;
        d: var(--close-button-path-d);
        fill: currentColor;
      }

      /**
       * Ripples
       */

      #ripples {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        z-index: -1;
        contain: strict;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 200px;
        height: 200px;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        will-change: opacity, transform;
        pointer-events: none;
      }

      /**
       * Selection indicator
       */

      #selection-indicator {
        display: none;
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: var(--selection-indicator-height);
        background: var(--selection-indicator-color);
        pointer-events: none;
      }
      :host([selected]) #selection-indicator {
        display: block;
      }
      :host-context(x-doctabs[animatingindicator]) #selection-indicator {
        display: none;
      }
    </style>

    <div id="ripples"></div>
    <div id="selection-indicator"></div>

    <slot></slot>

    <svg id="close-button" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="close-button-path"></path>
    </svg>
  </template>
`;

  // @events
  //   close
  class XDocTabElement extends HTMLElement {
    static get observedAttributes() {
      return ["selected", "disabled"];
    }

    // @type
    //   XDocTabsElement
    // @readOnly
    get ownerTabs() {
      return this.closest("x-doctabs");
    }

    // @info
    //   Value associated with this tab.
    // @type
    //   string
    // @default
    //   ""
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : "";
    }
    set value(value) {
      this.setAttribute("value", value);
    }

    // @property
    //   reflected
    // @type
    //   boolean
    // @default
    //   false
    get selected() {
      return this.hasAttribute("selected");
    }
    set selected(selected) {
      selected ? this.setAttribute("selected", "") : this.removeAttribute("selected");
    }

    // @property
    //   reflected
    // @type
    //   boolean
    // @default
    //   false
    get edited() {
      return this.hasAttribute("edited");
    }
    set edited(edited) {
      edited ? this.setAttribute("edited", "") : this.removeAttribute("edited");
    }

    // @property
    //   reflected
    // @type
    //   boolean
    // @default
    //   false
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled === true ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$9.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#close-button"].addEventListener("pointerdown", (event) => this._onCloseButtonPointerDown(event));
      this["#close-button"].addEventListener("click", (event) => this._onCloseButtonClick(event));
      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
    }

    connectedCallback() {
      this.setAttribute("tabindex", this.selected ? "0" : "-1");
      this.setAttribute("role", "tab");
      this.setAttribute("aria-selected", this.selected);
      this.setAttribute("aria-disabled", this.disabled);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "selected") {
        this._onSelectedAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onSelectedAttributeChange() {
      this.setAttribute("aria-selected", this.selected);
      this.setAttribute("tabindex", this.selected ? "0" : "-1");
    }

    _onDisabledAttributeChange() {
      this.setAttribute("aria-disabled", this.disabled);
      this.setAttribute("tabindex", this.selected ? "0" : "-1");
    }

    _onPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        pointerDownEvent.preventDefault();
        return;
      }

      // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
      if (this.matches(":focus") === false) {
        pointerDownEvent.preventDefault();

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      // Provide "pressed" attribute for theming purposes
      {
        let pointerDownTimeStamp = Date.now();

        this.setAttribute("pressed", "");
        this.setPointerCapture(pointerDownEvent.pointerId);

        this.addEventListener("lostpointercapture", async (event) => {
          if (this.selected === true) {
            let pressedTime = Date.now() - pointerDownTimeStamp;
            let minPressedTime = 100;

            if (pressedTime < minPressedTime) {
              await sleep(minPressedTime - pressedTime);
            }
          }

          this.removeAttribute("pressed");
        }, {once: true});
      }

      // Ripple
      {
        let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

        if (rippleType === "bounded") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max$4(rect.width, rect.height) * 1.5;
          let top  = pointerDownEvent.clientY - rect.y - size/2;
          let left = pointerDownEvent.clientX - rect.x - size/2;

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple pointer-down-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
          this["#ripples"].append(ripple);

          let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing: easing$3 });

          // Pointer capture is set on the owner tabs rather than this tab intentionally. Owner tabs might be
          // already capturing the pointer and hijacking it would disrupt the currently performed tab move
          // operation.
          this.ownerTabs.setPointerCapture(pointerDownEvent.pointerId);

          this.ownerTabs.addEventListener("lostpointercapture", async () => {
            await inAnimation.finished;

            let fromOpacity = getComputedStyle(ripple).opacity;
            let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"]}, { duration: 300, easing: easing$3 });
            await outAnimation.finished;

            ripple.remove();
          }, {once: true});
        }
      }
    }

    async _onClick(event) {
      if (event.button !== 0) {
        return;
      }

      // Ripple
      if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
        let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

        if (rippleType === "bounded") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max$4(rect.width, rect.height) * 1.5;
          let top  = (rect.y + rect.height/2) - rect.y - size/2;
          let left = (rect.x + rect.width/2) - rect.x - size/2;

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple click-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
          this["#ripples"].append(ripple);

          let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing: easing$3 });
          await inAnimation.finished;

          let fromOpacity = getComputedStyle(ripple).opacity;
          let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"] }, { duration: 300, easing: easing$3 });
          await outAnimation.finished;

          ripple.remove();
        }
      }
    }

    _onCloseButtonPointerDown(event) {
      if (event.buttons !== 1) {
        return;
      }

      event.stopPropagation();
    }

    _onCloseButtonClick(event) {
      if (event.button !== 0) {
        return;
      }

      event.stopPropagation();

      let customEvent = new CustomEvent("close", {bubbles: true, cancelable: true, detail: this});
      this.dispatchEvent(customEvent);

      if (customEvent.defaultPrevented === false) {
        this.ownerTabs.closeTab(this);
      }
    }
  }
  customElements.define("x-doctab", XDocTabElement);

  let {parseInt: parseInt$2} = Number;

  let shadowTemplate$a = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        width: 100%;
        position: relative;
        --open-button-width: 24px;
        --open-button-height: 24px;
        --open-button-margin: 0 10px;
        --open-button-path-d: path(
          "M 79 54 L 54 54 L 54 79 L 46 79 L 46 54 L 21 54 L 21 46 L 46 46 L 46 21 L 54 21 L 54 46 L 79 46 L 79 54 Z"
        );
      }
      :host(:focus) {
        outline: none;
      }
      :host([disabled]) {
        opacity: 0.5;
        pointer-events: none;
      }

      #open-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--open-button-width);
        height: var(--open-button-height);
        margin: var(--open-button-margin);
        order: 9999;
        opacity: 0.7;
        color: inherit;
        -webkit-app-region: no-drag;
      }
      #open-button:hover {
        opacity: 1;
      }

      #open-button-path {
        d: var(--open-button-path-d);
        fill: currentColor;
      }

      #selection-indicator-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        pointer-events: none;
      }

      #selection-indicator {
        position: absolute;
        width: 100%;
        bottom: 0;
        left: 0;
      }
    </style>

    <slot></slot>

    <div id="selection-indicator-container">
      <div id="selection-indicator" hidden></div>
    </div>

    <svg id="open-button" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="open-button-path"></path>
    </svg>
  </template>
`;

  // @events
  //   open
  //   close
  //   select
  //   rearrange
  class XDocTabsElement extends HTMLElement {
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled === true ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    // @info
    //   Maximal number of tambs that can be opened
    // @type
    //   number
    // @default
    //   20
    // @attribute
    get maxTabs() {
      return this.hasAttribute("maxtabs") ? parseInt$2(this.getAttribute("maxtabs")) : 20;
    }
    set maxTabs(maxTabs) {
      this.setAttribute("maxtabs", maxTabs);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._waitingForTabToClose = false;
      this._waitingForPointerMoveAfterClosingTab = false;

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate$a.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this["#open-button"].addEventListener("click", (event) => this._onOpenButtonClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    openTab(tab, animate = true) {
      return new Promise( async (resolve, reject) => {
        let tabs = this.querySelectorAll("x-doctab");

        if (tabs.length >= this.maxTabs) {
          reject(`Can't open more than ${this.maxTabs} tabs.`);
        }
        else {
          let maxOrder = 0;

          for (let tab of this.children) {
            let order = parseInt$2(tab.style.order);

            if (!Number.isNaN(order) && order > maxOrder) {
              maxOrder = order;
            }
          }
          tab.style.order = maxOrder;

          if (animate === false) {
            tab.style.transition = "none";
            tab.style.maxWidth = null;
            tab.style.padding = null;

            this.append(tab);
            tab.focus();
            resolve(tab);
          }
          else if (animate === true) {
            tab.style.transition = null;
            tab.style.maxWidth = "0px";
            tab.style.padding = "0px";

            tab.setAttribute("opening", "");
            this.append(tab);
            await sleep(30);

            tab.addEventListener("transitionend", () => {
              tab.removeAttribute("opening");
              resolve(tab);
            }, {once: true});

            tab.style.maxWidth = null;
            tab.style.padding = null;
            tab.focus();
          }
        }
      });
    }

    closeTab(tab, animate = true) {
      return new Promise( async (resolve) => {
        let tabs = this.getTabsByScreenIndex().filter(tab => tab.hasAttribute("closing") === false);
        let tabWidth = tab.getBoundingClientRect().width;
        let tabScreenIndex = this._getTabScreenIndex(tab);

        tab.setAttribute("closing", "");

        if (tabScreenIndex < tabs.length - 1) {
          for (let tab of this.children) {
            if (tab.hasAttribute("closing") === false) {
              tab.style.transition = "none";
              tab.style.maxWidth = tabWidth + "px";
            }
          }
        }

        if (animate) {
          tab.style.transition = null;
        }
        else {
          tab.style.transition = "none";
        }

        tab.style.maxWidth = "0px";
        tab.style.pointerEvents = "none";

        this._waitingForTabToClose = true;

        if (tab.selected) {
          let previousTab = tabs[tabs.indexOf(tab) - 1];
          let nextTab = tabs[tabs.indexOf(tab) + 1];

          tab.selected = false;

          if (nextTab) {
            nextTab.selected = true;
          }
          else if (previousTab) {
            previousTab.selected = true;
          }
        }

        if (tab.matches(":focus")) {
          let selectedTab = this.querySelector("x-doctab[selected]");

          if (selectedTab) {
            selectedTab.focus();
          }
          else {
            this.focus();
          }
        }

        tab.style.maxWidth = "0px";
        tab.style.padding = "0px";

        if (animate) {
          await sleep(150);
        }

        tab.remove();
        this._waitingForTabToClose = false;
        tab.removeAttribute("closing");

        resolve();

        if (!this._waitingForPointerMoveAfterClosingTab) {
          this._waitingForPointerMoveAfterClosingTab = true;
          await this._whenPointerMoved(3);
          this._waitingForPointerMoveAfterClosingTab = false;

          for (let tab of this.children) {
            tab.style.transition = null;
            tab.style.maxWidth = null;
            tab.style.order = this._getTabScreenIndex(tab);
          }
        }
      });
    }

    selectPreviousTab() {
      let tabs = this.getTabsByScreenIndex();
      let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab");
      let previousTab = this._getPreviousTabOnScreen(currentTab);

      if (currentTab && previousTab) {
        this.selectTab(previousTab);

        return previousTab;
      }

      return null;
    }

    selectNextTab() {
      let tabs = this.getTabsByScreenIndex();
      let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab:last-of-type");
      let nextTab = this._getNextTabOnScreen(currentTab);

      if (currentTab && nextTab) {
        this.selectTab(nextTab);

        return nextTab;
      }

      return null;
    }

    selectTab(nextTab) {
      let currentTab = this.querySelector(`x-doctab[selected]`) || this.querySelector("x-doctab:last-of-type");

      if (currentTab) {
        currentTab.tabIndex = -1;
        currentTab.selected = false;
      }

      nextTab.tabIndex = 0;
      nextTab.selected = true;
    }

    moveSelectedTabLeft() {
      let selectedTab = this.querySelector("x-doctab[selected]");
      let selectedTabScreenIndex = this._getTabScreenIndex(selectedTab);

      for (let tab of this.children) {
        tab.style.order = this._getTabScreenIndex(tab);
      }

      if (parseInt$2(selectedTab.style.order) === 0) {
        for (let tab of this.children) {
          if (tab === selectedTab) {
            tab.style.order = this.childElementCount - 1;
          }
          else {
            tab.style.order = parseInt$2(tab.style.order) - 1;
          }
        }
      }
      else {
        let otherTab = this._getTabWithScreenIndex(selectedTabScreenIndex - 1);
        otherTab.style.order = parseInt$2(otherTab.style.order) + 1;
        selectedTab.style.order = parseInt$2(selectedTab.style.order) - 1;
      }
    }

    moveSelectedTabRight() {
      let selectedTab = this.querySelector("x-doctab[selected]");
      let selectedTabScreenIndex = this._getTabScreenIndex(selectedTab);

      for (let tab of this.children) {
        tab.style.order = this._getTabScreenIndex(tab);
      }

      if (parseInt$2(selectedTab.style.order) === this.childElementCount - 1) {
        for (let tab of this.children) {
          if (tab === selectedTab) {
            tab.style.order = 0;
          }
          else {
            tab.style.order = parseInt$2(tab.style.order) + 1;
          }
        }
      }
      else {
        let otherTab = this._getTabWithScreenIndex(selectedTabScreenIndex + 1);
        otherTab.style.order = parseInt$2(otherTab.style.order) - 1;
        selectedTab.style.order = parseInt$2(selectedTab.style.order) + 1;
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Returns a promise that is resolved when the pointer is moved by at least the given distance.
    // @type
    //   (number) => Promise
    _whenPointerMoved(distance = 3) {
      return new Promise((resolve) => {
        let pointerMoveListener, pointerOutListener, blurListener;
        let fromPoint = null;

        let removeListeners = () => {
          window.removeEventListener("pointermove", pointerMoveListener);
          window.removeEventListener("pointerout", pointerOutListener);
          window.removeEventListener("blur", blurListener);
        };

        window.addEventListener("pointermove", pointerMoveListener = (event) => {
          if (fromPoint === null) {
            fromPoint = {x: event.clientX, y: event.clientY};
          }
          else {
            let toPoint = {x: event.clientX, y: event.clientY};

            if (getDistanceBetweenPoints(fromPoint, toPoint) >= distance) {
              removeListeners();
              resolve();
            }
          }
        });

        window.addEventListener("pointerout", pointerOutListener = (event) => {
          if (event.toElement === null) {
            removeListeners();
            resolve();
          }
        });

        window.addEventListener("blur", blurListener = () => {
          removeListeners();
          resolve();
        });
      });
    }

    _animateSelectionIndicator(fromTab, toTab) {
      let mainBBox = this.getBoundingClientRect();
      let startBBox = fromTab ? fromTab.getBoundingClientRect() : null;
      let endBBox = toTab.getBoundingClientRect();
      let computedStyle = getComputedStyle(toTab);

      if (startBBox === null) {
        startBBox = DOMRect.fromRect(endBBox);
        startBBox.x += startBBox.width / 2;
        startBBox.width = 0;
      }

      this["#selection-indicator"].style.height = computedStyle.getPropertyValue("--selection-indicator-height");
      this["#selection-indicator"].style.background = computedStyle.getPropertyValue("--selection-indicator-color");
      this["#selection-indicator"].hidden = false;

      this.setAttribute("animatingindicator", "");

      let animation = this["#selection-indicator"].animate(
        [
          {
            bottom: (startBBox.bottom - mainBBox.bottom) + "px",
            left: (startBBox.left - mainBBox.left) + "px",
            width: startBBox.width + "px",
          },
          {
            bottom: (endBBox.bottom - mainBBox.bottom) + "px",
            left: (endBBox.left - mainBBox.left) + "px",
            width: endBBox.width + "px",
          }
        ],
        {
          duration: 200,
          iterations: 1,
          delay: 0,
          easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
        }
      );

      animation.finished.then(() => {
        this["#selection-indicator"].hidden = true;
        this.removeAttribute("animatingindicator");
      });

      return animation;
    }

    getTabsByScreenIndex() {
      let $screenIndex = Symbol();

      for (let tab of this.children) {
        tab[$screenIndex] = this._getTabScreenIndex(tab);
      }

      return [...this.children].sort((tab1, tab2) => tab1[$screenIndex] > tab2[$screenIndex]);
    }

    _getTabScreenIndex(tab) {
      let tabBounds = tab.getBoundingClientRect();
      let tabsBounds = this.getBoundingClientRect();

      if (tabBounds.left - tabsBounds.left < tabBounds.width / 2) {
        return 0;
      }
      else {
        let offset = (tabBounds.width / 2);

        for (let i = 1; i < this.maxTabs; i += 1) {
          if (tabBounds.left - tabsBounds.left >= offset &&
              tabBounds.left - tabsBounds.left < offset + tabBounds.width) {
            if (i > this.childElementCount - 1) {
              return this.childElementCount - 1;
            }
            else {
              return i;
            }
          }
          else {
            offset += tabBounds.width;
          }
        }
      }
    }

    _getTabWithScreenIndex(screenIndex) {
      for (let tab of this.children) {
        if (this._getTabScreenIndex(tab) === screenIndex) {
          return tab;
        }
      }

      return null;
    }

    _getPreviousTabOnScreen(tab, skipDisabled = true, wrapAround = true) {
      let tabs = this.getTabsByScreenIndex();
      let tabScreenIndex = tabs.indexOf(tab);
      let previousTab = null;

      for (let i = tabScreenIndex - 1; i >= 0; i -= 1) {
        let tab = tabs[i];

        if (skipDisabled && tab.disabled) {
          continue;
        }
        else {
          previousTab = tab;
          break;
        }
      }

      if (wrapAround) {
        if (previousTab === null) {
          for (let i = tabs.length - 1; i > tabScreenIndex; i -= 1) {
            let tab = tabs[i];

            if (skipDisabled && tab.disabled) {
              continue;
            }
            else {
              previousTab = tab;
              break;
            }
          }
        }
      }

      return previousTab;
    }

    // @info
    //   Get previous tab on screen.
    _getNextTabOnScreen(tab, skipDisabled = true, wrapAround = true) {
      let tabs = this.getTabsByScreenIndex();
      let tabScreenIndex = tabs.indexOf(tab);
      let nextTab = null;

      for (let i = tabScreenIndex + 1; i < tabs.length; i += 1) {
        let tab = tabs[i];

        if (skipDisabled && tab.disabled) {
          continue;
        }
        else {
          nextTab = tab;
          break;
        }
      }

      if (wrapAround) {
        if (nextTab === null) {
          for (let i = 0; i < tabScreenIndex; i += 1) {
            let tab = tabs[i];

            if (skipDisabled && tab.disabled) {
              continue;
            }
            else {
              nextTab = tab;
              break;
            }
          }
        }
      }

      return nextTab;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onPointerDown(event) {
      if (event.buttons === 1 && !this._waitingForTabToClose && event.target.closest("x-doctab")) {
        this._onTabPointerDown(event);
      }
    }

    _onTabPointerDown(pointerDownEvent) {
      if (pointerDownEvent.isPrimary === false) {
        return;
      }

      let pointerMoveListener, lostPointerCaptureListener;
      let pointerDownTab = pointerDownEvent.target.closest("x-doctab");
      let selectedTab = this.querySelector("x-doctab[selected]");

      this.selectTab(pointerDownTab);
      if (selectedTab != pointerDownTab) {
        this.dispatchEvent(new CustomEvent("select", {detail: pointerDownTab}));
      }

      let selectionIndicatorAnimation = this._animateSelectionIndicator(selectedTab, pointerDownTab);
      this.setPointerCapture(pointerDownEvent.pointerId);

      let pointerDownPoint = new DOMPoint(pointerDownEvent.clientX, pointerDownEvent.clientY);

      this.addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        let pointerMovePoint = new DOMPoint(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
        let deltaTime = pointerMoveEvent.timeStamp - pointerDownEvent.timeStamp;
        let isIntentional = (getDistanceBetweenPoints(pointerDownPoint, pointerMovePoint) > 3 || deltaTime > 80);

        if (pointerMoveEvent.isPrimary && isIntentional) {
          this.removeEventListener("pointermove", pointerMoveListener);
          this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

          selectionIndicatorAnimation.finish();
          this._onTabDragStart(pointerDownEvent, pointerDownTab);
        }
      });

      this.addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this.removeEventListener("pointermove", pointerMoveListener);
        this.removeEventListener("lostpointercapture", lostPointerCaptureListener);
      });
    }

    _onTabDragStart(firstPointerMoveEvent, draggedTab) {
      let tabBounds = draggedTab.getBoundingClientRect();
      let tabsBounds = this.getBoundingClientRect();

      let $initialScreenIndex = Symbol();
      let $screenIndex = Symbol();
      let $flexOffset = Symbol();

      draggedTab.style.zIndex = 999;
      this["#open-button"].style.opacity = "0";

      for (let tab of this.children) {
        let screenIndex = this._getTabScreenIndex(tab);
        tab[$screenIndex] = screenIndex;
        tab[$initialScreenIndex] = screenIndex;
        tab[$flexOffset] = tab.getBoundingClientRect().left - tabsBounds.left;

        if (tab !== draggedTab) {
          tab.style.transition = "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)";
        }
      }

      let onDraggedTabScreenIndexChange = (fromScreenIndex, toScreenIndex) => {
        if (toScreenIndex > fromScreenIndex + 1) {
          for (let i = fromScreenIndex; i < toScreenIndex; i += 1) {
            onDraggedTabScreenIndexChange(i, i + 1);
          }
        }
        else if (toScreenIndex < fromScreenIndex - 1) {
          for (let i = fromScreenIndex; i > toScreenIndex; i -= 1) {
            onDraggedTabScreenIndexChange(i, i - 1);
          }
        }
        else {
          for (let tab of this.children) {
            if (tab !== draggedTab) {
              if (tab[$screenIndex] === toScreenIndex) {
                tab[$screenIndex] = fromScreenIndex;
              }

              let translateX = -tab[$flexOffset];

              for (let i = 0; i < tab[$screenIndex]; i += 1) {
                translateX += tabBounds.width;
              }

              if (translateX === 0) {
                tab.style.transform = null;
              }
              else {
                tab.style.transform = "translate(" + translateX + "px)";
              }
            }
          }
        }
      };

      let pointerMoveListener = (pointerMoveEvent) => {
        if (pointerMoveEvent.isPrimary) {
          let dragOffset = pointerMoveEvent.clientX - firstPointerMoveEvent.clientX;

          if (dragOffset + draggedTab[$flexOffset] <= 0) {
            dragOffset = -draggedTab[$flexOffset];
          }
          else if (dragOffset + draggedTab[$flexOffset] + tabBounds.width > tabsBounds.width) {
            dragOffset = tabsBounds.width - draggedTab[$flexOffset] - tabBounds.width;
          }

          draggedTab.style.transform = "translate(" + dragOffset + "px)";
          let screenIndex = this._getTabScreenIndex(draggedTab);

          if (screenIndex !== draggedTab[$screenIndex]) {
            let previousTabScreenIndex = draggedTab[$screenIndex];
            draggedTab[$screenIndex] = screenIndex;
            onDraggedTabScreenIndexChange(previousTabScreenIndex, draggedTab[$screenIndex]);
          }
        }
      };

      let lostPointerCaptureListener = async (dragEndEvent) => {
        this.removeEventListener("pointermove", pointerMoveListener);
        this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

        let translateX = -draggedTab[$flexOffset];

        for (let i = 0; i < draggedTab[$screenIndex]; i += 1) {
          translateX += tabBounds.width;
        }

        draggedTab.style.transition = "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)";
        draggedTab.style.transform = "translate(" + translateX + "px)";

        if (draggedTab[$initialScreenIndex] !== draggedTab[$screenIndex]) {
          this.dispatchEvent(
            new CustomEvent("rearrange")
          );
        }

        await sleep(150);

        draggedTab.style.zIndex = null;
        this["#open-button"].style.opacity = null;

        for (let tab of this.children) {
          tab.style.transition = "none";
          tab.style.transform = "translate(0px, 0px)";
          tab.style.order = tab[$screenIndex];
        }
      };

      this.addEventListener("pointermove", pointerMoveListener);
      this.addEventListener("lostpointercapture", lostPointerCaptureListener);
    }

    _onOpenButtonClick(clickEvent) {
      if (clickEvent.button === 0) {
        let customEvent = new CustomEvent("open", {cancelable: true});
        this.dispatchEvent(customEvent);

        if (customEvent.defaultPrevented === false) {
          let openedTab = html`<x-doctab><x-label>Untitled</x-label></x-doctab>`;
          openedTab.style.order = this.childElementCount;
          this.openTab(openedTab);

          this.selectTab(openedTab);
        }
      }
    }

    _onKeyDown(event) {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
        return;
      }

      else if (event.code === "Enter" || event.code === "Space") {
        let currentTab = this.querySelector(`x-doctab[tabindex="0"]`);
        let selectedTab = this.querySelector(`x-doctab[selected]`);

        event.preventDefault();
        currentTab.click();

        if (currentTab !== selectedTab) {
          this.selectTab(currentTab);
          this._animateSelectionIndicator(selectedTab, currentTab);
        }
      }

      else if (event.code === "ArrowLeft") {
        let tabs = this.getTabsByScreenIndex();
        let currentTab = this.querySelector(`x-doctab[tabindex="0"]`);
        let previousTab = this._getPreviousTabOnScreen(currentTab);

        if (previousTab) {
          event.preventDefault();

          currentTab.tabIndex = -1;
          previousTab.tabIndex = 0;
          previousTab.focus();
        }
      }

      else if (event.code === "ArrowRight") {
        let tabs = this.getTabsByScreenIndex();
        let currentTab = this.querySelector(`x-doctab[tabindex="0"]`);
        let nextTab = this._getNextTabOnScreen(currentTab);

        if (nextTab) {
          event.preventDefault();

          currentTab.tabIndex = -1;
          nextTab.tabIndex = 0;
          nextTab.focus();
        }
      }
    }
  }
  customElements.define("x-doctabs", XDocTabsElement);

  // @copyright
  //   © 2016-2017 Jarosław Foksa

  let readFile = (url) => {
    return new Promise( (resolve, reject) => {
      let xhr = new XMLHttpRequest;
      xhr.open("GET", url);
      xhr.send(null);

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve(xhr.responseText);
        }
        else {
          reject(xhr.status);
        }
      };

      xhr.onerror = () => {
        reject(xhr.status);
      };
    })
  };

  let cache = {};

  let shadowTemplate$b = html`
  <template>
    <style>
      :host {
        display: block;
        color: currentColor;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        overflow: hidden;
      }
      :host([disabled]) {
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      #svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
        stroke: none;
        overflow: inherit;
        /* @bugfix: pointerOverEvent.relatedTarget leaks shadow DOM of <x-icon> */
        pointer-events: none;
      }
    </style>

    <svg id="svg" preserveAspectRatio="none" viewBox="0 0 100 100" width="0px" height="0px"></svg>
  </template>
`;

  class XIconElement extends HTMLElement {
    static get observedAttributes() {
      return ["name", "iconset"];
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get name() {
      return this.hasAttribute("name") ? this.getAttribute("name") : "";
    }
    set name(name) {
      this.setAttribute("name", name);
    }

    // @type
    //   string?
    // @default
    //   null
    // @attribute
    get iconset() {
      if (this.hasAttribute("iconset") === false || this.getAttribute("iconset").trim() === "") {
        return null;
      }
      else {
        return this.getAttribute("iconset");
      }
    }
    set iconset(iconset) {
      if (iconset === null || iconset.trim() === "") {
        this.removeAttribute("iconset");
      }
      else {
        this.setAttribute("iconset", iconset);
      }
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$b.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "name") {
        this._update();
      }
      else if (name === "iconset") {
        this._update();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async _update() {
      if (this.name === "") {
        this["#svg"].innerHTML = "";
      }
      else {
        let symbol = await this._getSymbol(this.name, this.iconset);

        if (symbol) {
          this["#svg"].setAttribute("viewBox", symbol.getAttribute("viewBox"));
          this["#svg"].innerHTML = symbol.innerHTML;
        }
        else {
          this["#svg"].innerHTML = "";
        }
      }
    }

    _getSymbol(name, iconsetURL) {
      return new Promise(async (resolve) => {
        let iconset = null;

        // Default iconset
        if (iconsetURL === null) {
          // Development - default iconset must be read from a file
          if (XIconElement.DEFAULT_ICONSET === null) {
            iconset = await this._getIconset("node_modules/xel/iconsets/default.svg");
          }
          // Production - default iconset is embedded into xel.min.js
          else {
            iconset = XIconElement.DEFAULT_ICONSET;
          }
        }
        // Custom iconset
        else {
          iconset = await this._getIconset(iconsetURL);
        }

        let symbol = null;

        if (iconset) {
          symbol = iconset.querySelector("#" + CSS.escape(name));
        }

        resolve(symbol);
      });
    }

    _getIconset(iconsetURL) {
      return new Promise(async (resolve) => {
        if (cache[iconsetURL]) {
          if (cache[iconsetURL].iconset) {
            resolve(cache[iconsetURL].iconset);
          }
          else {
            cache[iconsetURL].callbacks.push(resolve);
          }
        }
        else {
          cache[iconsetURL] = {callbacks: [resolve], iconset: null};

          let iconsetSVG = null;

          try {
            iconsetSVG = await readFile(iconsetURL);
          }
          catch (error) {
            iconsetSVG = null;
          }

          if (iconsetSVG) {
            cache[iconsetURL].iconset = svg`${iconsetSVG}`;

            for (let callback of cache[iconsetURL].callbacks) {
              callback(cache[iconsetURL].iconset);
            }
          }
        }
      });
    }
  }

  XIconElement.DEFAULT_ICONSET = svg`<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <g data-category="xel">
    <symbol id="arrow-thick" viewBox="0 0 100 100">
      <path d="M 0.736 20.365 L 49.999 87.922 L 99.264 20.365 Z"/>
    </symbol>
    <symbol id="arrow-thin" viewBox="0 0 100 100">
      <path d="M 11.699 19.846 L 49.822 57.886 L 87.945 19.846 L 99.657 31.557 L 49.822 81.392 L -0.013 31.557 Z"/>
    </symbol>
    <symbol id="question" viewBox="0 0 100 100">
      <path d="M 41.81 99.136 L 58.19 99.136 L 58.19 82.756 L 41.81 82.756 L 41.81 99.136 Z"/>
      <path d="M 50 0.864 C 31.902 0.864 17.244 15.523 17.244 33.62 L 33.62 33.62 C 33.62 24.614 40.993 17.244 50 17.244 C 59.007 17.244 66.38 24.614 66.38 33.62 C 66.38 50 41.81 47.952 41.81 74.566 L 58.19 74.566 C 58.19 56.142 82.756 54.093 82.756 33.62 C 82.756 15.523 68.098 0.864 50 0.864 Z"/>
    </symbol>
    <symbol id="extensions-color" viewBox="0 0 100 100">
      <path d="M 86.821 47.906 L 80.136 47.906 L 80.136 30.077 C 80.136 25.174 76.124 21.163 71.222 21.163 L 53.393 21.163 L 53.393 14.476 C 53.393 8.325 48.4 3.332 42.25 3.332 C 36.098 3.332 31.106 8.325 31.106 14.476 L 31.106 21.163 L 13.276 21.163 C 8.374 21.163 4.406 25.174 4.406 30.077 L 4.406 47.015 L 11.048 47.015 C 17.689 47.015 23.083 52.409 23.083 59.049 C 23.083 65.692 17.689 71.085 11.048 71.085 L 4.36 71.085 L 4.36 88.023 C 4.36 92.925 8.374 96.938 13.276 96.938 L 30.214 96.938 L 30.214 90.25 C 30.214 83.61 35.607 78.216 42.25 78.216 C 48.89 78.216 54.284 83.61 54.284 90.25 L 54.284 96.938 L 71.222 96.938 C 76.124 96.938 80.136 92.925 80.136 88.023 L 80.136 70.193 L 86.821 70.193 C 92.974 70.193 97.966 65.201 97.966 59.049 C 97.966 52.899 92.974 47.906 86.821 47.906 Z" style="fill: rgb(12, 146, 255); stroke: rgb(14, 81, 136); stroke-width: 2;"/>
    </symbol>
  </g>
  <g data-category="action">
    <symbol viewBox="0 0 24 24" id="rotate-3d">
      <path d="M7.52 21.48A10.487 10.487 0 0 1 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32zm.89-6.52c-.19 0-.37-.03-.52-.08a1.07 1.07 0 0 1-.4-.24.99.99 0 0 1-.26-.37c-.06-.14-.09-.3-.09-.47h-1.3c0 .36.07.68.21.95.14.27.33.5.56.69.24.18.51.32.82.41.3.1.62.15.96.15.37 0 .72-.05 1.03-.15.32-.1.6-.25.83-.44s.42-.43.55-.72c.13-.29.2-.61.2-.97 0-.19-.02-.38-.07-.56a1.67 1.67 0 0 0-.23-.51c-.1-.16-.24-.3-.4-.43-.17-.13-.37-.23-.61-.31a2.098 2.098 0 0 0 .89-.75c.1-.15.17-.3.22-.46.05-.16.07-.32.07-.48 0-.36-.06-.68-.18-.96a1.78 1.78 0 0 0-.51-.69c-.2-.19-.47-.33-.77-.43C9.1 8.05 8.76 8 8.39 8c-.36 0-.69.05-1 .16-.3.11-.57.26-.79.45-.21.19-.38.41-.51.67-.12.26-.18.54-.18.85h1.3c0-.17.03-.32.09-.45s.14-.25.25-.34c.11-.09.23-.17.38-.22.15-.05.3-.08.48-.08.4 0 .7.1.89.31.19.2.29.49.29.86 0 .18-.03.34-.08.49a.87.87 0 0 1-.25.37c-.11.1-.25.18-.41.24-.16.06-.36.09-.58.09H7.5v1.03h.77c.22 0 .42.02.6.07s.33.13.45.23c.12.11.22.24.29.4.07.16.1.35.1.57 0 .41-.12.72-.35.93-.23.23-.55.33-.95.33zm8.55-5.92c-.32-.33-.7-.59-1.14-.77-.43-.18-.92-.27-1.46-.27H12v8h2.3c.55 0 1.06-.09 1.51-.27.45-.18.84-.43 1.16-.76.32-.33.57-.73.74-1.19.17-.47.26-.99.26-1.57v-.4c0-.58-.09-1.1-.26-1.57-.18-.47-.43-.87-.75-1.2zm-.39 3.16c0 .42-.05.79-.14 1.13-.1.33-.24.62-.43.85-.19.23-.43.41-.71.53-.29.12-.62.18-.99.18h-.91V9.12h.97c.72 0 1.27.23 1.64.69.38.46.57 1.12.57 1.99v.4zM12 0l-.66.03 3.81 3.81 1.33-1.33c3.27 1.55 5.61 4.72 5.96 8.48h1.5C23.44 4.84 18.29 0 12 0z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="accessibility">
      <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="accessible">
      <circle cx="12" cy="4" r="2"/>
      <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zm-6.17 5c-.41 1.16-1.52 2-2.83 2-1.66 0-3-1.34-3-3 0-1.31.84-2.41 2-2.83V12.1a5 5 0 1 0 5.9 5.9h-2.07z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="account-balance">
      <path d="M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="account-balance-wallet">
      <path d="M21 18v1c0 1.1-.9 2-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14c1.1 0 2 .9 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="account-box">
      <path d="M3 5v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5a2 2 0 0 0-2 2zm12 4c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm-9 8c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1H6v-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="account-circle">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="add-shopping-cart">
      <path d="M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-9.83-3.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4h-.01l-1.1 2-2.76 5H8.53l-.13-.27L6.16 6l-.95-2-.94-2H1v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.13 0-.25-.11-.25-.25z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="alarm">
      <path d="M22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM12.5 8H11v6l4.75 2.85.75-1.23-4-2.37V8zM12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a9 9 0 0 0 0-18zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="alarm-add">
      <path d="M7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a9 9 0 0 0 0-18zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="alarm-off">
      <path d="M12 6c3.87 0 7 3.13 7 7 0 .84-.16 1.65-.43 2.4l1.52 1.52c.58-1.19.91-2.51.91-3.92a9 9 0 0 0-9-9c-1.41 0-2.73.33-3.92.91L9.6 6.43C10.35 6.16 11.16 6 12 6zm10-.28l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM2.92 2.29L1.65 3.57 2.98 4.9l-1.11.93 1.42 1.42 1.11-.94.8.8A8.964 8.964 0 0 0 3 13c0 4.97 4.02 9 9 9 2.25 0 4.31-.83 5.89-2.2l2.2 2.2 1.27-1.27L3.89 3.27l-.97-.98zm13.55 16.1C15.26 19.39 13.7 20 12 20c-3.87 0-7-3.13-7-7 0-1.7.61-3.26 1.61-4.47l9.86 9.86zM8.02 3.28L6.6 1.86l-.86.71 1.42 1.42.86-.71z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="alarm-on">
      <path d="M22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a9 9 0 0 0 0-18zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm-1.46-5.47L8.41 12.4l-1.06 1.06 3.18 3.18 6-6-1.06-1.06-4.93 4.95z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="all-out">
      <path d="M16.21 4.16l4 4v-4zm4 12l-4 4h4zm-12 4l-4-4v4zm-4-12l4-4h-4zm12.95-.95c-2.73-2.73-7.17-2.73-9.9 0s-2.73 7.17 0 9.9 7.17 2.73 9.9 0 2.73-7.16 0-9.9zm-1.1 8.8c-2.13 2.13-5.57 2.13-7.7 0s-2.13-5.57 0-7.7 5.57-2.13 7.7 0 2.13 5.57 0 7.7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="android">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31A5.983 5.983 0 0 0 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="announcement">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="aspect-ratio">
      <path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assessment">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assignment">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assignment-ind">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assignment-late">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 15h-2v-2h2v2zm0-4h-2V8h2v6zm-1-9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assignment-return">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4 12h-4v3l-5-5 5-5v3h4v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assignment-returned">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 15l-5-5h3V9h4v4h3l-5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assignment-turned-in">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="autorenew">
      <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="backup">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="book">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bookmark">
      <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bookmark-border">
      <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bug-report">
      <path d="M20 8h-2.81a5.985 5.985 0 0 0-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="build">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cached">
      <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6a5.87 5.87 0 0 1-2.8-.7l-1.46 1.46A7.93 7.93 0 0 0 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46A7.93 7.93 0 0 0 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="camera-enhance">
      <path d="M9 3L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2h-3.17L15 3H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-1l1.25-2.75L16 13l-2.75-1.25L12 9l-1.25 2.75L8 13l2.75 1.25z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="card-giftcard">
      <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68A3.01 3.01 0 0 0 9 2C7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="card-membership">
      <path d="M20 2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h4v5l4-2 4 2v-5h4c1.11 0 2-.89 2-2V4c0-1.11-.89-2-2-2zm0 13H4v-2h16v2zm0-5H4V4h16v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="card-travel">
      <path d="M20 6h-3V4c0-1.11-.89-2-2-2H9c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zM9 4h6v2H9V4zm11 15H4v-2h16v2zm0-5H4V8h3v2h2V8h6v2h2V8h3v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="change-history">
      <path d="M12 7.77L18.39 18H5.61L12 7.77M12 4L2 20h20L12 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="check-circle">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="chrome-reader-mode">
      <path d="M13 12h7v1.5h-7zm0-2.5h7V11h-7zm0 5h7V16h-7zM21 4H3c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 15h-9V6h9v13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="class">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="code">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="compare-arrows">
      <path d="M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="copyright">
      <path d="M10.08 10.86c.05-.33.16-.62.3-.87s.34-.46.59-.62c.24-.15.54-.22.91-.23.23.01.44.05.63.13.2.09.38.21.52.36s.25.33.34.53.13.42.14.64h1.79c-.02-.47-.11-.9-.28-1.29s-.4-.73-.7-1.01-.66-.5-1.08-.66-.88-.23-1.39-.23c-.65 0-1.22.11-1.7.34s-.88.53-1.2.92-.56.84-.71 1.36S8 11.29 8 11.87v.27c0 .58.08 1.12.23 1.64s.39.97.71 1.35.72.69 1.2.91 1.05.34 1.7.34c.47 0 .91-.08 1.32-.23s.77-.36 1.08-.63.56-.58.74-.94.29-.74.3-1.15h-1.79c-.01.21-.06.4-.15.58s-.21.33-.36.46-.32.23-.52.3c-.19.07-.39.09-.6.1-.36-.01-.66-.08-.89-.23-.25-.16-.45-.37-.59-.62s-.25-.55-.3-.88-.08-.67-.08-1v-.27c0-.35.03-.68.08-1.01zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="credit-card">
      <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="dashboard">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="date-range">
      <path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="delete">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="delete-forever">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="description">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="dns">
      <path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="done">
      <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="done-all">
      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="donut-large">
      <path d="M11 5.08V2c-5 .5-9 4.81-9 10s4 9.5 9 10v-3.08c-3-.48-6-3.4-6-6.92s3-6.44 6-6.92zM18.97 11H22c-.47-5-4-8.53-9-9v3.08C16 5.51 18.54 8 18.97 11zM13 18.92V22c5-.47 8.53-4 9-9h-3.03c-.43 3-2.97 5.49-5.97 5.92z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="donut-small">
      <path d="M11 9.16V2c-5 .5-9 4.79-9 10s4 9.5 9 10v-7.16c-1-.41-2-1.52-2-2.84s1-2.43 2-2.84zM14.86 11H22c-.48-4.75-4-8.53-9-9v7.16c1 .3 1.52.98 1.86 1.84zM13 14.84V22c5-.47 8.52-4.25 9-9h-7.14c-.34.86-.86 1.54-1.86 1.84z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="eject">
      <path d="M5 17h14v2H5zm7-12L5.33 15h13.34z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="euro-symbol">
      <path d="M15 18.5A6.48 6.48 0 0 1 9.24 15H15v-2H8.58c-.05-.33-.08-.66-.08-1s.03-.67.08-1H15V9H9.24A6.49 6.49 0 0 1 15 5.5c1.61 0 3.09.59 4.23 1.57L21 5.3A8.955 8.955 0 0 0 15 3c-3.92 0-7.24 2.51-8.48 6H3v2h3.06a8.262 8.262 0 0 0 0 2H3v2h3.52c1.24 3.49 4.56 6 8.48 6 2.31 0 4.41-.87 6-2.3l-1.78-1.77c-1.13.98-2.6 1.57-4.22 1.57z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="event">
      <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="event-seat">
      <path d="M4 18v3h3v-3h10v3h3v-6H4zm15-8h3v3h-3zM2 10h3v3H2zm15 3H7V5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="exit-to-app">
      <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="explore">
      <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="extension">
      <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 2.7-2.7 2.7 2.7 0 0 1 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="face">
      <path d="M9 11.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm6 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.23-2.98 5.21-5.37a9.974 9.974 0 0 0 10.41 3.97c.21.71.33 1.47.33 2.26 0 4.41-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="favorite">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="favorite-border">
      <path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="feedback">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="find-in-page">
      <path d="M20 19.59V8l-6-6H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c.45 0 .85-.15 1.19-.4l-4.43-4.43c-.8.52-1.74.83-2.76.83-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 1.02-.31 1.96-.83 2.75L20 19.59zM9 13c0 1.66 1.34 3 3 3s3-1.34 3-3-1.34-3-3-3-3 1.34-3 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="find-replace">
      <path d="M11 6c1.38 0 2.63.56 3.54 1.46L12 10h6V4l-2.05 2.05A6.976 6.976 0 0 0 11 4c-3.53 0-6.43 2.61-6.92 6H6.1A5 5 0 0 1 11 6zm5.64 9.14A6.89 6.89 0 0 0 17.92 12H15.9a5 5 0 0 1-4.9 4c-1.38 0-2.63-.56-3.54-1.46L10 12H4v6l2.05-2.05A6.976 6.976 0 0 0 11 18c1.55 0 2.98-.51 4.14-1.36L20 21.49 21.49 20l-4.85-4.86z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fingerprint">
      <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41a.51.51 0 0 1-.68-.2.506.506 0 0 1 .2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67a.49.49 0 0 1-.44.28zM3.5 9.72a.5.5 0 0 1-.41-.79c.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25a.5.5 0 0 1-.12.7.5.5 0 0 1-.7-.12 9.388 9.388 0 0 0-3.39-2.94c-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07a.47.47 0 0 1-.35-.15c-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1a7.297 7.297 0 0 1-2.17-5.22c0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29a11.14 11.14 0 0 1-.73-3.96c0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flight-land">
      <path d="M2.5 19h19v2h-19zm7.18-5.73l4.35 1.16 5.31 1.42c.8.21 1.62-.26 1.84-1.06.21-.8-.26-1.62-1.06-1.84l-5.31-1.42-2.76-9.02L10.12 2v8.28L5.15 8.95l-.93-2.32-1.45-.39v5.17l1.6.43 5.31 1.43z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flight-takeoff">
      <path d="M2.5 19h19v2h-19zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 1.82 3.16.77 1.33 1.6-.43 5.31-1.42 4.35-1.16L21 11.49c.81-.23 1.28-1.05 1.07-1.85z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flip-to-back">
      <path d="M9 7H7v2h2V7zm0 4H7v2h2v-2zm0-8a2 2 0 0 0-2 2h2V3zm4 12h-2v2h2v-2zm6-12v2h2c0-1.1-.9-2-2-2zm-6 0h-2v2h2V3zM9 17v-2H7a2 2 0 0 0 2 2zm10-4h2v-2h-2v2zm0-4h2V7h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zM5 7H3v12a2 2 0 0 0 2 2h12v-2H5V7zm10-2h2V3h-2v2zm0 12h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flip-to-front">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm2 4v-2H3a2 2 0 0 0 2 2zM3 9h2V7H3v2zm12 12h2v-2h-2v2zm4-18H9a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H9V5h10v10zm-8 6h2v-2h-2v2zm-4 0h2v-2H7v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="g-translate">
      <path d="M20 5h-9.12L10 2H4c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h7l1 3h8c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zM7.17 14.59c-2.25 0-4.09-1.83-4.09-4.09s1.83-4.09 4.09-4.09c1.04 0 1.99.37 2.74 1.07l.07.06-1.23 1.18-.06-.05c-.29-.27-.78-.59-1.52-.59-1.31 0-2.38 1.09-2.38 2.42s1.07 2.42 2.38 2.42c1.37 0 1.96-.87 2.12-1.46H7.08V9.91h3.95l.01.07c.04.21.05.4.05.61 0 2.35-1.61 4-3.92 4zm6.03-1.71c.33.6.74 1.18 1.19 1.7l-.54.53-.65-2.23zm.77-.76h-.99l-.31-1.04h3.99s-.34 1.31-1.56 2.74a9.18 9.18 0 0 1-1.13-1.7zM21 20c0 .55-.45 1-1 1h-7l2-2-.81-2.77.92-.92L17.79 18l.73-.73-2.71-2.68c.9-1.03 1.6-2.25 1.92-3.51H19v-1.04h-3.64V9h-1.04v1.04h-1.96L11.18 6H20c.55 0 1 .45 1 1v13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gavel">
      <path d="M1 21h12v2H1zM5.245 8.07l2.83-2.827 14.14 14.142-2.828 2.828zM12.317 1l5.657 5.656-2.83 2.83-5.654-5.66zM3.825 9.485l5.657 5.657-2.828 2.828-5.657-5.657z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="get-app">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gif">
      <path d="M11.5 9H13v6h-1.5zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3c.6 0 1-.5 1-1v-2H8.5v1.5h-2v-3H10V10c0-.5-.4-1-1-1zm10 1.5V9h-4.5v6H16v-2h2v-1.5h-2v-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="grade">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="group-work">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8 17.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5zM9.5 8a2.5 2.5 0 0 1 5 0 2.5 2.5 0 0 1-5 0zm6.5 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="help">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="help-outline">
      <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14a4 4 0 0 0-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="highlight-off">
      <path d="M14.59 8L12 10.59 9.41 8 8 9.41 10.59 12 8 14.59 9.41 16 12 13.41 14.59 16 16 14.59 13.41 12 16 9.41 14.59 8zM12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="history">
      <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="home">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hourglass-empty">
      <path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hourglass-full">
      <path d="M6 2v6h.01L6 8.01 10 12l-4 4 .01.01H6V22h12v-5.99h-.01L18 16l-4-4 4-3.99-.01-.01H18V2H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="http">
      <path d="M4.5 11h-2V9H1v6h1.5v-2.5h2V15H6V9H4.5v2zm2.5-.5h1.5V15H10v-4.5h1.5V9H7v1.5zm5.5 0H14V15h1.5v-4.5H17V9h-4.5v1.5zm9-1.5H18v6h1.5v-2h2c.8 0 1.5-.7 1.5-1.5v-1c0-.8-.7-1.5-1.5-1.5zm0 2.5h-2v-1h2v1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="https">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="important-devices">
      <path d="M23 11.01L18 11c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h5c.55 0 1-.45 1-1v-9c0-.55-.45-.99-1-.99zM23 20h-5v-7h5v7zM20 2H2C.89 2 0 2.89 0 4v12a2 2 0 0 0 2 2h7v2H7v2h8v-2h-2v-2h2v-2H2V4h18v5h2V4a2 2 0 0 0-2-2zm-8.03 7L11 6l-.97 3H7l2.47 1.76-.94 2.91 2.47-1.8 2.47 1.8-.94-2.91L15 9h-3.03z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="info">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="info-outline">
      <path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="input">
      <path d="M21 3.01H3c-1.1 0-2 .9-2 2V9h2V4.99h18v14.03H3V15H1v4.01c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98v-14a2 2 0 0 0-2-2zM11 16l4-4-4-4v3H1v2h10v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="invert-colors">
      <path d="M17.66 7.93L12 2.27 6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31A7.98 7.98 0 0 0 12 21.58c2.05 0 4.1-.78 5.66-2.34 3.12-3.12 3.12-8.19 0-11.31zM12 19.59c-1.6 0-3.11-.62-4.24-1.76C6.62 16.69 6 15.19 6 13.59s.62-3.11 1.76-4.24L12 5.1v14.49z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="label">
      <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="label-outline">
      <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="language">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="launch">
      <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="lightbulb-outline">
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="line-style">
      <path d="M3 16h5v-2H3v2zm6.5 0h5v-2h-5v2zm6.5 0h5v-2h-5v2zM3 20h2v-2H3v2zm4 0h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zM3 12h8v-2H3v2zm10 0h8v-2h-8v2zM3 4v4h18V4H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="line-weight">
      <path d="M3 17h18v-2H3v2zm0 3h18v-1H3v1zm0-7h18v-3H3v3zm0-9v4h18V4H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="list">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="lock">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="lock-open">
      <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="lock-outline">
      <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H8.9V6zM18 20H6V10h12v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="loyalty">
      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7zm11.77 8.27L13 19.54l-4.27-4.27A2.5 2.5 0 0 1 10.5 11c.69 0 1.32.28 1.77.74l.73.72.73-.73a2.5 2.5 0 0 1 3.54 3.54z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="markunread-mailbox">
      <path d="M20 6H10v6H8V4h6V0H6v6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="motorcycle">
      <path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM7.82 15C7.4 16.15 6.28 17 5 17c-1.63 0-3-1.37-3-3s1.37-3 3-3c1.28 0 2.4.85 2.82 2H5v2h2.82zM19 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="note-add">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="offline-pin">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm5 16H7v-2h10v2zm-6.7-4L7 10.7l1.4-1.4 1.9 1.9 5.3-5.3L17 7.3 10.3 14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="opacity">
      <path d="M17.66 8L12 2.35 6.34 8A8.02 8.02 0 0 0 4 13.64c0 2 .78 4.11 2.34 5.67a7.99 7.99 0 0 0 11.32 0c1.56-1.56 2.34-3.67 2.34-5.67S19.22 9.56 17.66 8zM6 14c.01-2 .62-3.27 1.76-4.4L12 5.27l4.24 4.38C17.38 10.77 17.99 12 18 14H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="open-in-browser">
      <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v-2H5V8h14v10h-4v2h4c1.1 0 2-.9 2-2V6a2 2 0 0 0-2-2zm-7 6l-4 4h3v6h2v-6h3l-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="open-in-new">
      <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="open-with">
      <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pageview">
      <path d="M11.5 9a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0 0-5zM20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-3.21 14.21l-2.91-2.91c-.69.44-1.51.7-2.39.7C9.01 16 7 13.99 7 11.5S9.01 7 11.5 7 16 9.01 16 11.5c0 .88-.26 1.69-.7 2.39l2.91 2.9-1.42 1.42z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pan-tool">
      <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="payment">
      <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-camera-mic">
      <path d="M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v-2.09c-2.83-.48-5-2.94-5-5.91h2c0 2.21 1.79 4 4 4s4-1.79 4-4h2c0 2.97-2.17 5.43-5 5.91V21h7c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-6 8c0 1.1-.9 2-2 2s-2-.9-2-2V9c0-1.1.9-2 2-2s2 .9 2 2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-contact-calendar">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-data-setting">
      <path d="M18.99 11.5c.34 0 .67.03 1 .07L20 0 0 20h11.56c-.04-.33-.07-.66-.07-1 0-4.14 3.36-7.5 7.5-7.5zm3.71 7.99c.02-.16.04-.32.04-.49 0-.17-.01-.33-.04-.49l1.06-.83a.26.26 0 0 0 .06-.32l-1-1.73c-.06-.11-.19-.15-.31-.11l-1.24.5c-.26-.2-.54-.37-.85-.49l-.19-1.32c-.01-.12-.12-.21-.24-.21h-2c-.12 0-.23.09-.25.21l-.19 1.32c-.3.13-.59.29-.85.49l-1.24-.5c-.11-.04-.24 0-.31.11l-1 1.73c-.06.11-.04.24.06.32l1.06.83a3.908 3.908 0 0 0 0 .98l-1.06.83a.26.26 0 0 0-.06.32l1 1.73c.06.11.19.15.31.11l1.24-.5c.26.2.54.37.85.49l.19 1.32c.02.12.12.21.25.21h2c.12 0 .23-.09.25-.21l.19-1.32c.3-.13.59-.29.84-.49l1.25.5c.11.04.24 0 .31-.11l1-1.73a.26.26 0 0 0-.06-.32l-1.07-.83zm-3.71 1.01c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-device-information">
      <path d="M13 7h-2v2h2V7zm0 4h-2v6h2v-6zm4-9.99L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-identity">
      <path d="M12 5.9a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2m0 9c2.97 0 6.1 1.46 6.1 2.1v1.1H5.9V17c0-.64 3.13-2.1 6.1-2.1M12 4C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-media">
      <path d="M2 6H0v5h.01L0 20c0 1.1.9 2 2 2h18v-2H2V6zm20-2h-8l-2-2H6c-1.1 0-1.99.9-1.99 2L4 16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM7 15l4.5-6 3.5 4.51 2.5-3.01L21 15H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-phone-msg">
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.074 15.074 0 0 1-6.59-6.58l2.2-2.21c.28-.27.36-.66.25-1.01A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM12 3v10l3-3h6V3h-9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="perm-scan-wifi">
      <path d="M12 3C6.95 3 3.15 4.85 0 7.23L12 22 24 7.25C20.85 4.87 17.05 3 12 3zm1 13h-2v-6h2v6zm-2-8V6h2v2h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pets">
      <circle cx="4.5" cy="9.5" r="2.5"/>
      <circle cx="9" cy="5.5" r="2.5"/>
      <circle cx="15" cy="5.5" r="2.5"/>
      <circle cx="19.5" cy="9.5" r="2.5"/>
      <path d="M17.34 14.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="picture-in-picture">
      <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="picture-in-picture-alt">
      <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="play-for-work">
      <path d="M11 5v5.59H7.5l4.5 4.5 4.5-4.5H13V5h-2zm-5 9c0 3.31 2.69 6 6 6s6-2.69 6-6h-2c0 2.21-1.79 4-4 4s-4-1.79-4-4H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="polymer">
      <path d="M19 4h-4L7.11 16.63 4.5 12 9 4H5L.5 12 5 20h4l7.89-12.63L19.5 12 15 20h4l4.5-8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="power-settings-new">
      <path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0 1 19 12c0 3.87-3.13 7-7 7A6.995 6.995 0 0 1 7.58 6.58L6.17 5.17A8.932 8.932 0 0 0 3 12a9 9 0 0 0 18 0c0-2.74-1.23-5.18-3.17-6.83z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pregnant-woman">
      <path d="M9 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm7 9a3.285 3.285 0 0 0-2-3c0-1.66-1.34-3-3-3s-3 1.34-3 3v7h2v5h3v-5h3v-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="print">
      <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="query-builder">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="question-answer">
      <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="receipt">
      <path d="M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="record-voice-over">
      <circle cx="9" cy="9" r="4"/>
      <path d="M9 15c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm7.76-9.64l-1.68 1.69c.84 1.18.84 2.71 0 3.89l1.68 1.69c2.02-2.02 2.02-5.07 0-7.27zM20.07 2l-1.63 1.63c2.77 3.02 2.77 7.56 0 10.74L20.07 16c3.9-3.89 3.91-9.95 0-14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="redeem">
      <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68A3.01 3.01 0 0 0 9 2C7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="remove-shopping-cart">
      <path d="M22.73 22.73L2.77 2.77 2 2l-.73-.73L0 2.54l4.39 4.39 2.21 4.66-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h7.46l1.38 1.38A1.997 1.997 0 0 0 17 22c.67 0 1.26-.33 1.62-.84L21.46 24l1.27-1.27zM7.42 15c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h2.36l2 2H7.42zm8.13-2c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H6.54l9.01 9zM7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="reorder">
      <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="report-problem">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="restore">
      <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="restore-page">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 16c-2.05 0-3.81-1.24-4.58-3h1.71c.63.9 1.68 1.5 2.87 1.5 1.93 0 3.5-1.57 3.5-3.5S13.93 9.5 12 9.5a3.5 3.5 0 0 0-3.1 1.9l1.6 1.6h-4V9l1.3 1.3C8.69 8.92 10.23 8 12 8c2.76 0 5 2.24 5 5s-2.24 5-5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="room">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rounded-corner">
      <path d="M19 19h2v2h-2v-2zm0-2h2v-2h-2v2zM3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm0-4h2V3H3v2zm4 0h2V3H7v2zm8 16h2v-2h-2v2zm-4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-8 0h2v-2H7v2zm-4 0h2v-2H3v2zM21 8c0-2.76-2.24-5-5-5h-5v2h5c1.65 0 3 1.35 3 3v5h2V8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rowing">
      <path d="M8.5 14.5L4 19l1.5 1.5L9 17h2l-2.5-2.5zM15 1c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 20.01L18 24l-2.99-3.01V19.5l-7.1-7.09c-.31.05-.61.07-.91.07v-2.16c1.66.03 3.61-.87 4.67-2.04l1.4-1.55c.19-.21.43-.38.69-.5.29-.14.62-.23.96-.23h.03C15.99 6.01 17 7.02 17 8.26v5.75a3 3 0 0 1-.92 2.16l-3.58-3.58v-2.27c-.63.52-1.43 1.02-2.29 1.39L16.5 18H18l3 3.01z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="schedule">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="search">
      <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings">
      <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65A.488.488 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-applications">
      <path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm7-7H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-1.75 9c0 .23-.02.46-.05.68l1.48 1.16c.13.11.17.3.08.45l-1.4 2.42c-.09.15-.27.21-.43.15l-1.74-.7c-.36.28-.76.51-1.18.69l-.26 1.85c-.03.17-.18.3-.35.3h-2.8c-.17 0-.32-.13-.35-.29l-.26-1.85c-.43-.18-.82-.41-1.18-.69l-1.74.7c-.16.06-.34 0-.43-.15l-1.4-2.42a.353.353 0 0 1 .08-.45l1.48-1.16c-.03-.23-.05-.46-.05-.69 0-.23.02-.46.05-.68l-1.48-1.16a.353.353 0 0 1-.08-.45l1.4-2.42c.09-.15.27-.21.43-.15l1.74.7c.36-.28.76-.51 1.18-.69l.26-1.85c.03-.17.18-.3.35-.3h2.8c.17 0 .32.13.35.29l.26 1.85c.43.18.82.41 1.18.69l1.74-.7c.16-.06.34 0 .43.15l1.4 2.42c.09.15.05.34-.08.45l-1.48 1.16c.03.23.05.46.05.69z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-backup-restore">
      <path d="M14 12c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2zm-2-9a9 9 0 0 0-9 9H0l4 4 4-4H5c0-3.87 3.13-7 7-7s7 3.13 7 7a6.995 6.995 0 0 1-11.06 5.7l-1.42 1.44A9 9 0 1 0 12 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-bluetooth">
      <path d="M11 24h2v-2h-2v2zm-4 0h2v-2H7v2zm8 0h2v-2h-2v2zm2.71-18.29L12 0h-1v7.59L6.41 3 5 4.41 10.59 10 5 15.59 6.41 17 11 12.41V20h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 3.83l1.88 1.88L13 7.59V3.83zm1.88 10.46L13 16.17v-3.76l1.88 1.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-brightness">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02zM8 16h2.5l1.5 1.5 1.5-1.5H16v-2.5l1.5-1.5-1.5-1.5V8h-2.5L12 6.5 10.5 8H8v2.5L6.5 12 8 13.5V16zm4-7c1.66 0 3 1.34 3 3s-1.34 3-3 3V9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-cell">
      <path d="M7 24h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zM16 .01L8 0C6.9 0 6 .9 6 2v16c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V2c0-1.1-.9-1.99-2-1.99zM16 16H8V4h8v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-ethernet">
      <path d="M7.77 6.76L6.23 5.48.82 12l5.41 6.52 1.54-1.28L3.42 12l4.35-5.24zM7 13h2v-2H7v2zm10-2h-2v2h2v-2zm-6 2h2v-2h-2v2zm6.77-7.52l-1.54 1.28L20.58 12l-4.35 5.24 1.54 1.28L23.18 12l-5.41-6.52z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-input-antenna">
      <path d="M12 5c-3.87 0-7 3.13-7 7h2c0-2.76 2.24-5 5-5s5 2.24 5 5h2c0-3.87-3.13-7-7-7zm1 9.29c.88-.39 1.5-1.26 1.5-2.29a2.5 2.5 0 0 0-5 0c0 1.02.62 1.9 1.5 2.29v3.3L7.59 21 9 22.41l3-3 3 3L16.41 21 13 17.59v-3.3zM12 1C5.93 1 1 5.93 1 12h2a9 9 0 0 1 18 0h2c0-6.07-4.93-11-11-11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-input-component">
      <path d="M5 2c0-.55-.45-1-1-1s-1 .45-1 1v4H1v6h6V6H5V2zm4 14c0 1.3.84 2.4 2 2.82V23h2v-4.18c1.16-.41 2-1.51 2-2.82v-2H9v2zm-8 0c0 1.3.84 2.4 2 2.82V23h2v-4.18C6.16 18.4 7 17.3 7 16v-2H1v2zM21 6V2c0-.55-.45-1-1-1s-1 .45-1 1v4h-2v6h6V6h-2zm-8-4c0-.55-.45-1-1-1s-1 .45-1 1v4H9v6h6V6h-2V2zm4 14c0 1.3.84 2.4 2 2.82V23h2v-4.18c1.16-.41 2-1.51 2-2.82v-2h-6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-input-composite">
      <path d="M5 2c0-.55-.45-1-1-1s-1 .45-1 1v4H1v6h6V6H5V2zm4 14c0 1.3.84 2.4 2 2.82V23h2v-4.18c1.16-.41 2-1.51 2-2.82v-2H9v2zm-8 0c0 1.3.84 2.4 2 2.82V23h2v-4.18C6.16 18.4 7 17.3 7 16v-2H1v2zM21 6V2c0-.55-.45-1-1-1s-1 .45-1 1v4h-2v6h6V6h-2zm-8-4c0-.55-.45-1-1-1s-1 .45-1 1v4H9v6h6V6h-2V2zm4 14c0 1.3.84 2.4 2 2.82V23h2v-4.18c1.16-.41 2-1.51 2-2.82v-2h-6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-input-hdmi">
      <path d="M18 7V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v3H5v6l3 6v3h8v-3l3-6V7h-1zM8 4h8v3h-2V5h-1v2h-2V5h-1v2H8V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-input-svideo">
      <path d="M8 11.5c0-.83-.67-1.5-1.5-1.5S5 10.67 5 11.5 5.67 13 6.5 13 8 12.33 8 11.5zm7-5c0-.83-.67-1.5-1.5-1.5h-3C9.67 5 9 5.67 9 6.5S9.67 8 10.5 8h3c.83 0 1.5-.67 1.5-1.5zM8.5 15c-.83 0-1.5.67-1.5 1.5S7.67 18 8.5 18s1.5-.67 1.5-1.5S9.33 15 8.5 15zM12 1C5.93 1 1 5.93 1 12s4.93 11 11 11 11-4.93 11-11S18.07 1 12 1zm0 20c-4.96 0-9-4.04-9-9s4.04-9 9-9 9 4.04 9 9-4.04 9-9 9zm5.5-11c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm-2 5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-overscan">
      <path d="M12.01 5.5L10 8h4l-1.99-2.5zM18 10v4l2.5-1.99L18 10zM6 10l-2.5 2.01L6 14v-4zm8 6h-4l2.01 2.5L14 16zm7-13H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-phone">
      <path d="M13 9h-2v2h2V9zm4 0h-2v2h2V9zm3 6.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.074 15.074 0 0 1-6.59-6.58l2.2-2.21c.28-.27.36-.66.25-1.01A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 9v2h2V9h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-power">
      <path d="M7 24h2v-2H7v2zm4 0h2v-2h-2v2zm2-22h-2v10h2V2zm3.56 2.44l-1.45 1.45A5.97 5.97 0 0 1 18 11c0 3.31-2.69 6-6 6s-6-2.69-6-6c0-2.17 1.16-4.06 2.88-5.12L7.44 4.44A7.96 7.96 0 0 0 4 11c0 4.42 3.58 8 8 8s8-3.58 8-8a7.96 7.96 0 0 0-3.44-6.56zM15 24h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-remote">
      <path d="M15 9H9c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V10c0-.55-.45-1-1-1zm-3 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM7.05 6.05l1.41 1.41a5.022 5.022 0 0 1 7.08 0l1.41-1.41C15.68 4.78 13.93 4 12 4s-3.68.78-4.95 2.05zM12 0C8.96 0 6.21 1.23 4.22 3.22l1.41 1.41C7.26 3.01 9.51 2 12 2s4.74 1.01 6.36 2.64l1.41-1.41C17.79 1.23 15.04 0 12 0z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-voice">
      <path d="M7 24h2v-2H7v2zm5-11c1.66 0 2.99-1.34 2.99-3L15 4c0-1.66-1.34-3-3-3S9 2.34 9 4v6c0 1.66 1.34 3 3 3zm-1 11h2v-2h-2v2zm4 0h2v-2h-2v2zm4-14h-1.7c0 3-2.54 5.1-5.3 5.1S6.7 13 6.7 10H5c0 3.41 2.72 6.23 6 6.72V20h2v-3.28c3.28-.49 6-3.31 6-6.72z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="shop">
      <path d="M16 6V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H2v13c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6h-6zm-6-2h4v2h-4V4zM9 18V9l7.5 4L9 18z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="shop-two">
      <path d="M3 9H1v11c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2H3V9zm15-4V3c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H5v11c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V5h-5zm-6-2h4v2h-4V3zm0 12V8l5.5 3-5.5 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="shopping-basket">
      <path d="M17.21 9l-4.38-6.56a.993.993 0 0 0-.83-.42c-.32 0-.64.14-.83.43L6.79 9H2c-.55 0-1 .45-1 1 0 .09.01.18.04.27l2.54 9.27c.23.84 1 1.46 1.92 1.46h13c.92 0 1.69-.62 1.93-1.46l2.54-9.27L23 10c0-.55-.45-1-1-1h-4.79zM9 9l3-4.4L15 9H9zm3 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="shopping-cart">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="speaker-notes">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 14H6v-2h2v2zm0-3H6V9h2v2zm0-3H6V6h2v2zm7 6h-5v-2h5v2zm3-3h-8V9h8v2zm0-3h-8V6h8v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="speaker-notes-off">
      <path d="M10.54 11l-.54-.54L7.54 8 6 6.46 2.38 2.84 1.27 1.73 0 3l2.01 2.01L2 22l4-4h9l5.73 5.73L22 22.46 17.54 18l-7-7zM8 14H6v-2h2v2zm-2-3V9l2 2H6zm14-9H4.08L10 7.92V6h8v2h-7.92l1 1H18v2h-4.92l6.99 6.99C21.14 17.95 22 17.08 22 16V4c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="spellcheck">
      <path d="M12.45 16h2.09L9.43 3H7.57L2.46 16h2.09l1.12-3h5.64l1.14 3zm-6.02-5L8.5 5.48 10.57 11H6.43zm15.16.59l-8.09 8.09L9.83 16l-1.41 1.41 5.09 5.09L23 13l-1.41-1.41z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="stars">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="store">
      <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="subject">
      <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="supervisor-account">
      <path d="M16.5 12c1.38 0 2.49-1.12 2.49-2.5S17.88 7 16.5 7a2.5 2.5 0 0 0 0 5zM9 11c1.66 0 2.99-1.34 2.99-3S10.66 5 9 5C7.34 5 6 6.34 6 8s1.34 3 3 3zm7.5 3c-1.83 0-5.5.92-5.5 2.75V19h11v-2.25c0-1.83-3.67-2.75-5.5-2.75zM9 13c-2.33 0-7 1.17-7 3.5V19h7v-2.25c0-.85.33-2.34 2.37-3.47C10.5 13.1 9.66 13 9 13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="swap-horiz">
      <path d="M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="swap-vert">
      <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="swap-vertical-circle">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM6.5 9L10 5.5 13.5 9H11v4H9V9H6.5zm11 6L14 18.5 10.5 15H13v-4h2v4h2.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="system-update-alt">
      <path d="M12 16.5l4-4h-3v-9h-2v9H8l4 4zm9-13h-6v1.99h6v14.03H3V5.49h6V3.5H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-14c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tab">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h10v4h8v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tab-unselected">
      <path d="M1 9h2V7H1v2zm0 4h2v-2H1v2zm0-8h2V3c-1.1 0-2 .9-2 2zm8 16h2v-2H9v2zm-8-4h2v-2H1v2zm2 4v-2H1c0 1.1.9 2 2 2zM21 3h-8v6h10V5c0-1.1-.9-2-2-2zm0 14h2v-2h-2v2zM9 5h2V3H9v2zM5 21h2v-2H5v2zM5 5h2V3H5v2zm16 16c1.1 0 2-.9 2-2h-2v2zm0-8h2v-2h-2v2zm-8 8h2v-2h-2v2zm4 0h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="theaters">
      <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="thumb-down">
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="thumb-up">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="thumbs-up-down">
      <path d="M12 6c0-.55-.45-1-1-1H5.82l.66-3.18.02-.23c0-.31-.13-.59-.33-.8L5.38 0 .44 4.94C.17 5.21 0 5.59 0 6v6.5c0 .83.67 1.5 1.5 1.5h6.75c.62 0 1.15-.38 1.38-.91l2.26-5.29c.07-.17.11-.36.11-.55V6zm10.5 4h-6.75c-.62 0-1.15.38-1.38.91l-2.26 5.29c-.07.17-.11.36-.11.55V18c0 .55.45 1 1 1h5.18l-.66 3.18-.02.24c0 .31.13.59.33.8l.79.78 4.94-4.94c.27-.27.44-.65.44-1.06v-6.5c0-.83-.67-1.5-1.5-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="timeline">
      <path d="M23 8c0 1.1-.9 2-2 2a1.7 1.7 0 0 1-.51-.07l-3.56 3.55c.05.16.07.34.07.52 0 1.1-.9 2-2 2s-2-.9-2-2c0-.18.02-.36.07-.52l-2.55-2.55c-.16.05-.34.07-.52.07s-.36-.02-.52-.07l-4.55 4.56c.05.16.07.33.07.51 0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2c.18 0 .35.02.51.07l4.56-4.55C8.02 9.36 8 9.18 8 9c0-1.1.9-2 2-2s2 .9 2 2c0 .18-.02.36-.07.52l2.55 2.55c.16-.05.34-.07.52-.07s.36.02.52.07l3.55-3.56A1.7 1.7 0 0 1 19 8c0-1.1.9-2 2-2s2 .9 2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="toc">
      <path d="M3 9h14V7H3v2zm0 4h14v-2H3v2zm0 4h14v-2H3v2zm16 0h2v-2h-2v2zm0-10v2h2V7h-2zm0 6h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="today">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="toll">
      <path d="M15 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zM3 12a5.99 5.99 0 0 1 4-5.65V4.26C3.55 5.15 1 8.27 1 12s2.55 6.85 6 7.74v-2.09A5.99 5.99 0 0 1 3 12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="touch-app">
      <path d="M 8.292 9.422 L 8.292 5.156 C 8.292 2.96 10.669 1.588 12.57 2.686 C 13.452 3.195 13.996 4.137 13.996 5.156 L 13.996 9.422 C 15.376 8.498 16.277 6.935 16.277 5.156 C 16.277 2.315 13.984 0.022 11.144 0.022 C 8.304 0.022 6.011 2.315 6.011 5.156 C 6.011 6.935 6.912 8.498 8.292 9.422 Z M 19.517 14.704 L 14.338 12.126 C 14.144 12.046 13.939 12 13.722 12 L 12.855 12 L 12.855 5.156 C 12.855 4.209 12.091 3.445 11.144 3.445 C 10.197 3.445 9.433 4.209 9.433 5.156 L 9.433 17.407 L 5.52 16.586 C 5.429 16.575 5.349 16.552 5.246 16.552 C 4.893 16.552 4.573 16.7 4.345 16.928 L 3.444 17.841 L 9.079 23.476 C 9.387 23.784 9.821 23.978 10.288 23.978 L 18.034 23.978 C 18.89 23.978 19.551 23.351 19.677 22.518 L 20.532 16.506 C 20.544 16.426 20.555 16.346 20.555 16.278 C 20.555 15.571 20.122 14.955 19.517 14.704 Z" style=""/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="track-changes">
      <path d="M19.07 4.93l-1.41 1.41A8.014 8.014 0 0 1 20 12c0 4.42-3.58 8-8 8s-8-3.58-8-8c0-4.08 3.05-7.44 7-7.93v2.02C8.16 6.57 6 9.03 6 12c0 3.31 2.69 6 6 6s6-2.69 6-6c0-1.66-.67-3.16-1.76-4.24l-1.41 1.41C15.55 9.9 16 10.9 16 12c0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.86 1.28-3.41 3-3.86v2.14c-.6.35-1 .98-1 1.72 0 1.1.9 2 2 2s2-.9 2-2c0-.74-.4-1.38-1-1.72V2h-1C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10a9.97 9.97 0 0 0-2.93-7.07z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="translate">
      <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="trending-down">
      <path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="trending-flat">
      <path d="M22 12l-4-4v3H3v2h15v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="trending-up">
      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="turned-in">
      <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="turned-in-not">
      <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="update">
      <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1a6.875 6.875 0 0 0 0 9.79 7.02 7.02 0 0 0 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58a8.987 8.987 0 0 1 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="verified-user">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-agenda">
      <path d="M20 13H3c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h17c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zm0-10H3c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h17c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-array">
      <path d="M4 18h3V5H4v13zM18 5v13h3V5h-3zM8 18h9V5H8v13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-carousel">
      <path d="M7 19h10V4H7v15zm-5-2h4V6H2v11zM18 6v11h4V6h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-column">
      <path d="M10 18h5V5h-5v13zm-6 0h5V5H4v13zM16 5v13h5V5h-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-day">
      <path d="M2 21h19v-3H2v3zM20 8H3c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h17c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zM2 3v3h19V3H2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-headline">
      <path d="M4 15h16v-2H4v2zm0 4h16v-2H4v2zm0-8h16V9H4v2zm0-6v2h16V5H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-list">
      <path d="M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-module">
      <path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-quilt">
      <path d="M10 18h5v-6h-5v6zm-6 0h5V5H4v13zm12 0h5v-6h-5v6zM10 5v6h11V5H10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-stream">
      <path d="M4 18h17v-6H4v6zM4 5v6h17V5H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-week">
      <path d="M6 5H3c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1zm14 0h-3c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1zm-7 0h-3c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h3c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="visibility">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="visibility-off">
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="watch-later">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="work">
      <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="youtube-searched-for">
      <path d="M17.01 14h-.8l-.27-.27a6.45 6.45 0 0 0 1.57-4.23c0-3.59-2.91-6.5-6.5-6.5s-6.5 3-6.5 6.5H2l3.84 4 4.16-4H6.51a4.5 4.5 0 0 1 9 0 4.507 4.507 0 0 1-6.32 4.12L7.71 15.1a6.474 6.474 0 0 0 7.52-.67l.27.27v.79l5.01 4.99L22 19l-4.99-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="zoom-in">
      <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zm2.5-4h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="zoom-out">
      <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z"/>
    </symbol>
  </g>
  <g data-category="alert">
    <symbol viewBox="0 0 24 24" id="add-alert">
      <path d="M10.01 21.01c0 1.1.89 1.99 1.99 1.99s1.99-.89 1.99-1.99h-3.98zm8.87-4.19V11c0-3.25-2.25-5.97-5.29-6.69v-.72C13.59 2.71 12.88 2 12 2s-1.59.71-1.59 1.59v.72A6.873 6.873 0 0 0 5.12 11v5.82L3 18.94V20h18v-1.06l-2.12-2.12zM16 13.01h-3v3h-2v-3H8V11h3V8h2v3h3v2.01z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="error">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="error-outline">
      <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="warning">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </symbol>
  </g>
  <g data-category="av">
    <symbol viewBox="0 0 24 24" id="add-to-queue">
      <path d="M21 3H3c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5a2 2 0 0 0-2-2zm0 14H3V5h18v12zm-5-7v2h-3v3h-2v-3H8v-2h3V7h2v3h3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airplay">
      <path d="M6 22h12l-6-6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="album">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="art-track">
      <path d="M22 13h-8v-2h8v2zm0-6h-8v2h8V7zm-8 10h8v-2h-8v2zm-2-8v6c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2zm-1.5 6l-2.25-3-1.75 2.26-1.25-1.51L3.5 15h7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="av-timer">
      <path d="M11 17c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1zm0-14v4h2V5.08c3.39.49 6 3.39 6 6.92 0 3.87-3.13 7-7 7s-7-3.13-7-7c0-1.68.59-3.22 1.58-4.42L12 13l1.41-1.41-6.8-6.8v.02C4.42 6.45 3 9.05 3 12c0 4.97 4.02 9 9 9a9 9 0 0 0 0-18h-1zm7 9c0-.55-.45-1-1-1s-1 .45-1 1 .45 1 1 1 1-.45 1-1zM6 12c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="branding-watermark">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16h-9v-6h9v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-to-action">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3v-3h18v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="closed-caption">
      <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="equalizer">
      <path d="M10 20h4V4h-4v16zm-6 0h4v-8H4v8zM16 9v11h4V9h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="explicit">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h4v2h-4v2h4v2H9V7h6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fast-forward">
      <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fast-rewind">
      <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="featured-play-list">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 8H3V9h9v2zm0-4H3V5h9v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="featured-video">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 9H3V5h9v7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fiber-dvr">
      <path d="M17.5 10.5h2v1h-2zm-13 0h2v3h-2zM21 3H3c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5c0-1.11-.89-2-2-2zM8 13.5c0 .85-.65 1.5-1.5 1.5H3V9h3.5c.85 0 1.5.65 1.5 1.5v3zm4.62 1.5h-1.5L9.37 9h1.5l1 3.43 1-3.43h1.5l-1.75 6zM21 11.5c0 .6-.4 1.15-.9 1.4L21 15h-1.5l-.85-2H17.5v2H16V9h3.5c.85 0 1.5.65 1.5 1.5v1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fiber-manual-record">
      <circle cx="12" cy="12" r="8"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fiber-new">
      <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zM8.5 15H7.3l-2.55-3.5V15H3.5V9h1.25l2.5 3.5V9H8.5v6zm5-4.74H11v1.12h2.5v1.26H11v1.11h2.5V15h-4V9h4v1.26zm7 3.74c0 .55-.45 1-1 1h-4c-.55 0-1-.45-1-1V9h1.25v4.51h1.13V9.99h1.25v3.51h1.12V9h1.25v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fiber-pin">
      <path d="M5.5 10.5h2v1h-2zM20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zM9 11.5c0 .85-.65 1.5-1.5 1.5h-2v2H4V9h3.5c.85 0 1.5.65 1.5 1.5v1zm3.5 3.5H11V9h1.5v6zm7.5 0h-1.2l-2.55-3.5V15H15V9h1.25l2.5 3.5V9H20v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fiber-smart-record">
      <g>
        <circle cx="9" cy="12" r="8"/>
        <path d="M17 4.26v2.09a5.99 5.99 0 0 1 0 11.3v2.09c3.45-.89 6-4.01 6-7.74s-2.55-6.85-6-7.74z"/>
      </g>
    </symbol>
    <symbol viewBox="0 0 24 24" id="forward-10">
      <path d="M4 13c0 4.4 3.6 8 8 8s8-3.6 8-8h-2c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6v4l5-5-5-5v4c-4.4 0-8 3.6-8 8zm6.8 3H10v-3.3L9 13v-.7l1.8-.6h.1V16zm4.3-1.8c0 .3 0 .6-.1.8l-.3.6s-.3.3-.5.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.5-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.5-.3.4-.1.6-.1.4 0 .6.1.3.2.5.3.2.3.3.6.1.5.1.8v.7zm-.8-.8v-.5s-.1-.2-.1-.3-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="forward-30">
      <path d="M9.6 13.5h.4c.2 0 .4-.1.5-.2s.2-.2.2-.4v-.2s-.1-.1-.1-.2-.1-.1-.2-.1h-.5s-.1.1-.2.1-.1.1-.1.2v.2h-1c0-.2 0-.3.1-.5s.2-.3.3-.4.3-.2.4-.2.4-.1.5-.1c.2 0 .4 0 .6.1s.3.1.5.2.2.2.3.4.1.3.1.5v.3s-.1.2-.1.3-.1.2-.2.2-.2.1-.3.2c.2.1.4.2.5.4s.2.4.2.6c0 .2 0 .4-.1.5s-.2.3-.3.4-.3.2-.5.2-.4.1-.6.1c-.2 0-.4 0-.5-.1s-.3-.1-.5-.2-.2-.2-.3-.4-.1-.4-.1-.6h.8v.2s.1.1.1.2.1.1.2.1h.5s.1-.1.2-.1.1-.1.1-.2v-.5s-.1-.1-.1-.2-.1-.1-.2-.1h-.6v-.7zm5.7.7c0 .3 0 .6-.1.8l-.3.6s-.3.3-.5.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.5-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.5-.3.4-.1.6-.1.4 0 .6.1.3.2.5.3.2.3.3.6.1.5.1.8v.7zm-.9-.8v-.5s-.1-.2-.1-.3-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5zM4 13c0 4.4 3.6 8 8 8s8-3.6 8-8h-2c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6v4l5-5-5-5v4c-4.4 0-8 3.6-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="forward-5">
      <path d="M4 13c0 4.4 3.6 8 8 8s8-3.6 8-8h-2c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6v4l5-5-5-5v4c-4.4 0-8 3.6-8 8zm6.7.9l.2-2.2h2.4v.7h-1.7l-.1.9s.1 0 .1-.1.1 0 .1-.1.1 0 .2 0h.2c.2 0 .4 0 .5.1s.3.2.4.3.2.3.3.5.1.4.1.6c0 .2 0 .4-.1.5s-.1.3-.3.5-.3.2-.5.3-.4.1-.6.1c-.2 0-.4 0-.5-.1s-.3-.1-.5-.2-.2-.2-.3-.4-.1-.3-.1-.5h.8c0 .2.1.3.2.4s.2.1.4.1c.1 0 .2 0 .3-.1l.2-.2s.1-.2.1-.3v-.6l-.1-.2-.2-.2s-.2-.1-.3-.1h-.2s-.1 0-.2.1-.1 0-.1.1-.1.1-.1.1h-.6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="games">
      <path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hd">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm2-6h4c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1h-4V9zm1.5 4.5h2v-3h-2v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hearing">
      <path d="M17 20c-.29 0-.56-.06-.76-.15-.71-.37-1.21-.88-1.71-2.38-.51-1.56-1.47-2.29-2.39-3-.79-.61-1.61-1.24-2.32-2.53C9.29 10.98 9 9.93 9 9c0-2.8 2.2-5 5-5s5 2.2 5 5h2c0-3.93-3.07-7-7-7S7 5.07 7 9c0 1.26.38 2.65 1.07 3.9.91 1.65 1.98 2.48 2.85 3.15.81.62 1.39 1.07 1.71 2.05.6 1.82 1.37 2.84 2.73 3.55A4 4 0 0 0 21 18h-2c0 1.1-.9 2-2 2zM7.64 2.64L6.22 1.22C4.23 3.21 3 5.96 3 9s1.23 5.79 3.22 7.78l1.41-1.41C6.01 13.74 5 11.49 5 9s1.01-4.74 2.64-6.36zM11.5 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0-5 0z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="high-quality">
      <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v6zm7-1c0 .55-.45 1-1 1h-.75v1.5h-1.5V15H14c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v4zm-3.5-.5h2v-3h-2v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="library-add">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="library-books">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="library-music">
      <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 5h-3v5.5a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1 2.5-2.5c.57 0 1.08.19 1.5.51V5h4v2zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="loop">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mic">
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mic-none">
      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1.2-9.1c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2l-.01 6.2c0 .66-.53 1.2-1.19 1.2-.66 0-1.2-.54-1.2-1.2V4.9zm6.5 6.1c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mic-off">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="movie">
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="music-video">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03A3.003 3.003 0 0 1 11 18c-1.66 0-3-1.34-3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="new-releases">
      <path d="M23 12l-2.44-2.78.34-3.68-3.61-.82-1.89-3.18L12 3 8.6 1.54 6.71 4.72l-3.61.81.34 3.68L1 12l2.44 2.78-.34 3.69 3.61.82 1.89 3.18L12 21l3.4 1.46 1.89-3.18 3.61-.82-.34-3.68L23 12zm-10 5h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="not-interested">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0 1 12 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0 1 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="note">
      <path d="M22 10l-6-6H4c-1.1 0-2 .9-2 2v12.01c0 1.1.9 1.99 2 1.99l16-.01c1.1 0 2-.89 2-1.99v-8zm-7-4.5l5.5 5.5H15V5.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pause">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pause-circle-filled">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pause-circle-outline">
      <path d="M9 16h2V8H9v8zm3-14C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-4h2V8h-2v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="play-arrow">
      <path d="M8 5v14l11-7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="play-circle-filled">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="play-circle-outline">
      <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="playlist-add">
      <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="playlist-add-check">
      <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm19.5-4.5L23 13l-6.99 7-4.51-4.5L13 14l3.01 3 5.49-5.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="playlist-play">
      <path d="M19 9H2v2h17V9zm0-4H2v2h17V5zM2 15h13v-2H2v2zm15-2v6l5-3-5-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="queue">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="queue-music">
      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="queue-play-next">
      <path d="M21 3H3c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h2v-2H3V5h18v8h2V5a2 2 0 0 0-2-2zm-8 7V7h-2v3H8v2h3v3h2v-3h3v-2h-3zm11 8l-4.5 4.5L18 21l3-3-3-3 1.5-1.5L24 18z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="radio">
      <path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="recent-actors">
      <path d="M21 5v14h2V5h-2zm-4 14h2V5h-2v14zM14 5H2c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1zM8 7.75c1.24 0 2.25 1.01 2.25 2.25S9.24 12.25 8 12.25 5.75 11.24 5.75 10 6.76 7.75 8 7.75zM12.5 17h-9v-.75c0-1.5 3-2.25 4.5-2.25s4.5.75 4.5 2.25V17z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="remove-from-queue">
      <path d="M21 3H3c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5a2 2 0 0 0-2-2zm0 14H3V5h18v12zm-5-7v2H8v-2h8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="repeat">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="repeat-one">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="replay-10">
      <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8zm-1.1 11H10v-3.3L9 13v-.7l1.8-.6h.1V16zm4.3-1.8c0 .3 0 .6-.1.8l-.3.6s-.3.3-.5.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.5-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.5-.3.4-.1.6-.1.4 0 .6.1c.2.1.3.2.5.3s.2.3.3.6.1.5.1.8v.7zm-.9-.8v-.5s-.1-.2-.1-.3-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="replay">
      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="replay-30">
      <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8zm-2.4 8.5h.4c.2 0 .4-.1.5-.2s.2-.2.2-.4v-.2s-.1-.1-.1-.2-.1-.1-.2-.1h-.5s-.1.1-.2.1-.1.1-.1.2v.2h-1c0-.2 0-.3.1-.5s.2-.3.3-.4.3-.2.4-.2.4-.1.5-.1c.2 0 .4 0 .6.1s.3.1.5.2.2.2.3.4.1.3.1.5v.3s-.1.2-.1.3-.1.2-.2.2-.2.1-.3.2c.2.1.4.2.5.4s.2.4.2.6c0 .2 0 .4-.1.5s-.2.3-.3.4-.3.2-.5.2-.4.1-.6.1c-.2 0-.4 0-.5-.1s-.3-.1-.5-.2-.2-.2-.3-.4-.1-.4-.1-.6h.8v.2s.1.1.1.2.1.1.2.1h.5s.1-.1.2-.1.1-.1.1-.2v-.5s-.1-.1-.1-.2-.1-.1-.2-.1h-.6v-.7zm5.7.7c0 .3 0 .6-.1.8l-.3.6s-.3.3-.5.3-.4.1-.6.1-.4 0-.6-.1-.3-.2-.5-.3-.2-.3-.3-.6-.1-.5-.1-.8v-.7c0-.3 0-.6.1-.8l.3-.6s.3-.3.5-.3.4-.1.6-.1.4 0 .6.1.3.2.5.3.2.3.3.6.1.5.1.8v.7zm-.8-.8v-.5c0-.1-.1-.2-.1-.3s-.1-.1-.2-.2-.2-.1-.3-.1-.2 0-.3.1l-.2.2s-.1.2-.1.3v2s.1.2.1.3.1.1.2.2.2.1.3.1.2 0 .3-.1l.2-.2s.1-.2.1-.3v-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="replay-5">
      <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8zm-1.3 8.9l.2-2.2h2.4v.7h-1.7l-.1.9s.1 0 .1-.1.1 0 .1-.1.1 0 .2 0h.2c.2 0 .4 0 .5.1s.3.2.4.3.2.3.3.5.1.4.1.6c0 .2 0 .4-.1.5s-.1.3-.3.5-.3.2-.4.3-.4.1-.6.1c-.2 0-.4 0-.5-.1s-.3-.1-.5-.2-.2-.2-.3-.4-.1-.3-.1-.5h.8c0 .2.1.3.2.4s.2.1.4.1c.1 0 .2 0 .3-.1l.2-.2s.1-.2.1-.3v-.6l-.1-.2-.2-.2s-.2-.1-.3-.1h-.2s-.1 0-.2.1-.1 0-.1.1-.1.1-.1.1h-.7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="shuffle">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="skip-next">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="skip-previous">
      <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="slow-motion-video">
      <path d="M13.05 9.79L10 7.5v9l3.05-2.29L16 12zm0 0L10 7.5v9l3.05-2.29L16 12zm0 0L10 7.5v9l3.05-2.29L16 12zM11 4.07V2.05c-2.01.2-3.84 1-5.32 2.21L7.1 5.69A7.94 7.94 0 0 1 11 4.07zM5.69 7.1L4.26 5.68A9.95 9.95 0 0 0 2.05 11h2.02a7.94 7.94 0 0 1 1.62-3.9zM4.07 13H2.05c.2 2.01 1 3.84 2.21 5.32l1.43-1.43A7.868 7.868 0 0 1 4.07 13zm1.61 6.74A9.98 9.98 0 0 0 11 21.95v-2.02a7.94 7.94 0 0 1-3.9-1.62l-1.42 1.43zM22 12c0 5.16-3.92 9.42-8.95 9.95v-2.02C16.97 19.41 20 16.05 20 12s-3.03-7.41-6.95-7.93V2.05C18.08 2.58 22 6.84 22 12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="snooze">
      <path d="M7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a9 9 0 0 0 0-18zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm-3-9h3.63L9 15.2V17h6v-2h-3.63L15 10.8V9H9v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sort-by-alpha">
      <path d="M14.94 4.66h-4.72l2.36-2.36zm-4.69 14.71h4.66l-2.33 2.33zM6.1 6.27L1.6 17.73h1.84l.92-2.45h5.11l.92 2.45h1.84L7.74 6.27H6.1zm-1.13 7.37l1.94-5.18 1.94 5.18H4.97zm10.76 2.5h6.12v1.59h-8.53v-1.29l5.92-8.56h-5.88v-1.6h8.3v1.26l-5.93 8.6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="stop">
      <path d="M6 6h12v12H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="subscriptions">
      <path d="M20 8H4V6h16v2zm-2-6H6v2h12V2zm4 10v8c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2zm-6 4l-6-3.27v6.53L16 16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="subtitles">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="surround-sound">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM7.76 16.24l-1.41 1.41A7.91 7.91 0 0 1 4 12c0-2.05.78-4.1 2.34-5.66l1.41 1.41C6.59 8.93 6 10.46 6 12s.59 3.07 1.76 4.24zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm5.66 1.66l-1.41-1.41C17.41 15.07 18 13.54 18 12s-.59-3.07-1.76-4.24l1.41-1.41A7.91 7.91 0 0 1 20 12c0 2.05-.78 4.1-2.34 5.66zM12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="video-call">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4zM14 13h-3v3H9v-3H6v-2h3V8h2v3h3v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="video-label">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H3V5h18v11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="video-library">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="videocam">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="videocam-off">
      <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="volume-down">
      <path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="volume-mute">
      <path d="M7 9v6h4l5 5V4l-5 5H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="volume-off">
      <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="volume-up">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="web">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="web-asset">
      <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6a2 2 0 0 0-2-2zm0 14H5V8h14v10z"/>
    </symbol>
  </g>
  <g data-category="communication">
    <symbol viewBox="0 0 24 24" id="business">
      <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call">
      <path d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-end">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-made">
      <path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-merge">
      <path d="M17 20.41L18.41 19 15 15.59 13.59 17 17 20.41zM7.5 8H11v5.59L5.59 19 7 20.41l6-6V8h3.5L12 3.5 7.5 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-missed">
      <path d="M19.59 7L12 14.59 6.41 9H11V7H3v8h2v-4.59l7 7 9-9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-missed-outgoing">
      <path d="M3 8.41l9 9 7-7V15h2V7h-8v2h4.59L12 14.59 4.41 7 3 8.41z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-received">
      <path d="M20 5.41L18.59 4 7 15.59V9H5v10h10v-2H8.41z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="call-split">
      <path d="M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4zm-4 0H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="chat">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="chat-bubble">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="chat-bubble-outline">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="clear-all">
      <path d="M5 13h14v-2H5v2zm-2 4h14v-2H3v2zM7 7v2h14V7H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="comment">
      <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="contact-mail">
      <path d="M21 8V7l-3 2-3-2v1l3 2 3-2zm1-5H2C.9 3 0 3.9 0 5v14c0 1.1.9 2 2 2h20c1.1 0 1.99-.9 1.99-2L24 5c0-1.1-.9-2-2-2zM8 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H2v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1zm8-6h-8V6h8v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="contact-phone">
      <path d="M22 3H2C.9 3 0 3.9 0 5v14c0 1.1.9 2 2 2h20c1.1 0 1.99-.9 1.99-2L24 5c0-1.1-.9-2-2-2zM8 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H2v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1zm3.85-4h1.64L21 16l-1.99 1.99A7.512 7.512 0 0 1 16.28 14c-.18-.64-.28-1.31-.28-2s.1-1.36.28-2a7.474 7.474 0 0 1 2.73-3.99L21 8l-1.51 2h-1.64c-.22.63-.35 1.3-.35 2s.13 1.37.35 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="contacts">
      <path d="M20 0H4v2h16V0zM4 24h16v-2H4v2zM20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2.75c1.24 0 2.25 1.01 2.25 2.25s-1.01 2.25-2.25 2.25S9.75 10.24 9.75 9 10.76 6.75 12 6.75zM17 17H7v-1.5c0-1.67 3.33-2.5 5-2.5s5 .83 5 2.5V17z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="dialer-sip">
      <path d="M17 3h-1v5h1V3zm-2 2h-2V4h2V3h-3v3h2v1h-2v1h3V5zm3-2v5h1V6h2V3h-3zm2 2h-1V4h1v1zm0 10.5c-1.25 0-2.45-.2-3.57-.57a.998.998 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21c.27-.26.35-.65.24-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="dialpad">
      <path d="M12 19c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 1c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-6 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="email">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="forum">
      <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="import-contacts">
      <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="import-export">
      <path d="M9 3L5 6.99h3V14h2V6.99h3L9 3zm7 14.01V10h-2v7.01h-3L15 21l4-3.99h-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="invert-colors-off">
      <path d="M20.65 20.87l-2.35-2.35-6.3-6.29-3.56-3.57-1.42-1.41L4.27 4.5 3 5.77l2.78 2.78a8.005 8.005 0 0 0 .56 10.69A7.98 7.98 0 0 0 12 21.58c1.79 0 3.57-.59 5.03-1.78l2.7 2.7L21 21.23l-.35-.36zM12 19.59c-1.6 0-3.11-.62-4.24-1.76A5.945 5.945 0 0 1 6 13.59c0-1.32.43-2.57 1.21-3.6L12 14.77v4.82zM12 5.1v4.58l7.25 7.26c1.37-2.96.84-6.57-1.6-9.01L12 2.27l-3.7 3.7 1.41 1.41L12 5.1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="live-help">
      <path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 16h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 11.9 13 12.5 13 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="location-off">
      <path d="M12 6.5A2.5 2.5 0 0 1 14.5 9c0 .74-.33 1.39-.83 1.85l3.63 3.63c.98-1.86 1.7-3.8 1.7-5.48 0-3.87-3.13-7-7-7a7 7 0 0 0-5.04 2.15l3.19 3.19c.46-.52 1.11-.84 1.85-.84zm4.37 9.6l-4.63-4.63-.11-.11L3.27 3 2 4.27l3.18 3.18C5.07 7.95 5 8.47 5 9c0 5.25 7 13 7 13s1.67-1.85 3.38-4.35L18.73 21 20 19.73l-3.63-3.63z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="location-on">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mail-outline">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="message">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="no-sim">
      <path d="M18.99 5c0-1.1-.89-2-1.99-2h-7L7.66 5.34 19 16.68 18.99 5zM3.65 3.88L2.38 5.15 5 7.77V19c0 1.1.9 2 2 2h10.01c.35 0 .67-.1.96-.26l1.88 1.88 1.27-1.27L3.65 3.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone">
      <path d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phonelink-erase">
      <path d="M13 8.2l-1-1-4 4-4-4-1 1 4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4zM19 1H9c-1.1 0-2 .9-2 2v3h2V4h10v16H9v-2H7v3c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phonelink-lock">
      <path d="M19 1H9c-1.1 0-2 .9-2 2v3h2V4h10v16H9v-2H7v3c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm-8.2 10V9.5C10.8 8.1 9.4 7 8 7S5.2 8.1 5.2 9.5V11c-.6 0-1.2.6-1.2 1.2v3.5c0 .7.6 1.3 1.2 1.3h5.5c.7 0 1.3-.6 1.3-1.2v-3.5c0-.7-.6-1.3-1.2-1.3zm-1.3 0h-3V9.5c0-.8.7-1.3 1.5-1.3s1.5.5 1.5 1.3V11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phonelink-ring">
      <path d="M20.1 7.7l-1 1c1.8 1.8 1.8 4.6 0 6.5l1 1c2.5-2.3 2.5-6.1 0-8.5zM18 9.8l-1 1c.5.7.5 1.6 0 2.3l1 1c1.2-1.2 1.2-3 0-4.3zM14 1H4c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 19H4V4h10v16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phonelink-setup">
      <path d="M11.8 12.5v-1l1.1-.8c.1-.1.1-.2.1-.3l-1-1.7c-.1-.1-.2-.2-.3-.1l-1.3.4c-.3-.2-.6-.4-.9-.5l-.2-1.3c0-.1-.1-.2-.3-.2H7c-.1 0-.2.1-.3.2l-.2 1.3c-.3.1-.6.3-.9.5l-1.3-.5c-.1 0-.2 0-.3.1l-1 1.7c-.1.1 0 .2.1.3l1.1.8v1l-1.1.8c-.1.2-.1.3-.1.4l1 1.7c.1.1.2.2.3.1l1.4-.4c.3.2.6.4.9.5l.2 1.3c-.1.1.1.2.2.2h2c.1 0 .2-.1.3-.2l.2-1.3c.3-.1.6-.3.9-.5l1.3.5c.1 0 .2 0 .3-.1l1-1.7c.1-.1 0-.2-.1-.3l-1.1-.9zM8 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM19 1H9c-1.1 0-2 .9-2 2v3h2V4h10v16H9v-2H7v3c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="portable-wifi-off">
      <path d="M17.56 14.24c.28-.69.44-1.45.44-2.24 0-3.31-2.69-6-6-6-.79 0-1.55.16-2.24.44l1.62 1.62c.2-.03.41-.06.62-.06a4 4 0 0 1 3.95 4.63l1.61 1.61zM12 4c4.42 0 8 3.58 8 8 0 1.35-.35 2.62-.95 3.74l1.47 1.47A9.86 9.86 0 0 0 22 12c0-5.52-4.48-10-10-10-1.91 0-3.69.55-5.21 1.47l1.46 1.46A8.04 8.04 0 0 1 12 4zM3.27 2.5L2 3.77l2.1 2.1C2.79 7.57 2 9.69 2 12c0 3.7 2.01 6.92 4.99 8.65l1-1.73C5.61 17.53 4 14.96 4 12c0-1.76.57-3.38 1.53-4.69l1.43 1.44C6.36 9.68 6 10.8 6 12c0 2.22 1.21 4.15 3 5.19l1-1.74c-1.19-.7-2-1.97-2-3.45 0-.65.17-1.25.44-1.79l1.58 1.58L10 12c0 1.1.9 2 2 2l.21-.02.01.01 7.51 7.51L21 20.23 4.27 3.5l-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="present-to-all">
      <path d="M21 3H3c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h18c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 16.02H3V4.98h18v14.04zM10 12H8l4-4 4 4h-2v4h-4v-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="ring-volume">
      <path d="M23.71 16.67A16.97 16.97 0 0 0 12 12C7.46 12 3.34 13.78.29 16.67c-.18.18-.29.43-.29.71 0 .28.11.53.29.71l2.48 2.48c.18.18.43.29.71.29.27 0 .52-.11.7-.28.79-.74 1.69-1.36 2.66-1.85.33-.16.56-.5.56-.9v-3.1c1.45-.48 3-.73 4.6-.73s3.15.25 4.6.72v3.1c0 .39.23.74.56.9.98.49 1.87 1.12 2.66 1.85.18.18.43.28.7.28.28 0 .53-.11.71-.29l2.48-2.48c.18-.18.29-.43.29-.71a.99.99 0 0 0-.29-.7zM21.16 6.26l-1.41-1.41-3.56 3.55 1.41 1.41s3.45-3.52 3.56-3.55zM13 2h-2v5h2V2zM6.4 9.81L7.81 8.4 4.26 4.84 2.84 6.26c.11.03 3.56 3.55 3.56 3.55z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rss-feed">
      <circle cx="6.18" cy="17.82" r="2.18"/>
      <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83c0-8.59-6.97-15.56-15.56-15.56zm0 5.66v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.47-4.43-9.9-9.9-9.9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="screen-share">
      <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6a2 2 0 0 0-2-2H4c-1.11 0-2 .89-2 2v10a2 2 0 0 0 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78 0-4.61.85-6 2.72.56-2.67 2.11-5.33 6-5.87V7l4 3.73-4 3.74z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="speaker-phone">
      <path d="M7 7.07L8.43 8.5c.91-.91 2.18-1.48 3.57-1.48s2.66.57 3.57 1.48L17 7.07C15.72 5.79 13.95 5 12 5s-3.72.79-5 2.07zM12 1C8.98 1 6.24 2.23 4.25 4.21l1.41 1.41C7.28 4 9.53 3 12 3s4.72 1 6.34 2.62l1.41-1.41A10.963 10.963 0 0 0 12 1zm2.86 9.01L9.14 10C8.51 10 8 10.51 8 11.14v9.71c0 .63.51 1.14 1.14 1.14h5.71c.63 0 1.14-.51 1.14-1.14v-9.71c.01-.63-.5-1.13-1.13-1.13zM15 20H9v-8h6v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="stay-current-landscape">
      <path d="M1.01 7L1 17c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H3c-1.1 0-1.99.9-1.99 2zM19 7v10H5V7h14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="stay-current-portrait">
      <path d="M17 1.01L7 1c-1.1 0-1.99.9-1.99 2v18c0 1.1.89 2 1.99 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="stay-primary-landscape">
      <path d="M1.01 7L1 17c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H3c-1.1 0-1.99.9-1.99 2zM19 7v10H5V7h14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="stay-primary-portrait">
      <path d="M17 1.01L7 1c-1.1 0-1.99.9-1.99 2v18c0 1.1.89 2 1.99 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="stop-screen-share">
      <path d="M21.22 18.02l2 2H24v-2h-2.78zm.77-2l.01-10a2 2 0 0 0-2-2H7.22l5.23 5.23c.18-.04.36-.07.55-.1V7.02l4 3.73-1.58 1.47 5.54 5.54c.61-.33 1.03-.99 1.03-1.74zM2.39 1.73L1.11 3l1.54 1.54c-.4.36-.65.89-.65 1.48v10a2 2 0 0 0 2 2H0v2h18.13l2.71 2.71 1.27-1.27L2.39 1.73zM7 15.02c.31-1.48.92-2.95 2.07-4.06l1.59 1.59c-1.54.38-2.7 1.18-3.66 2.47z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="swap-calls">
      <path d="M18 4l-4 4h3v7c0 1.1-.9 2-2 2s-2-.9-2-2V8c0-2.21-1.79-4-4-4S5 5.79 5 8v7H2l4 4 4-4H7V8c0-1.1.9-2 2-2s2 .9 2 2v7c0 2.21 1.79 4 4 4s4-1.79 4-4V8h3l-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="textsms">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="voicemail">
      <path d="M18.5 6C15.46 6 13 8.46 13 11.5c0 1.33.47 2.55 1.26 3.5H9.74A5.45 5.45 0 0 0 11 11.5C11 8.46 8.54 6 5.5 6S0 8.46 0 11.5 2.46 17 5.5 17h13c3.04 0 5.5-2.46 5.5-5.5S21.54 6 18.5 6zm-13 9C3.57 15 2 13.43 2 11.5S3.57 8 5.5 8 9 9.57 9 11.5 7.43 15 5.5 15zm13 0c-1.93 0-3.5-1.57-3.5-3.5S16.57 8 18.5 8 22 9.57 22 11.5 20.43 15 18.5 15z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="vpn-key">
      <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </symbol>
  </g>
  <g data-category="content">
    <symbol viewBox="0 0 24 24" id="add">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="add-box">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="add-circle">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="add-circle-outline">
      <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="archive">
      <path d="M20.54 5.23l-1.39-1.68A1.45 1.45 0 0 0 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="backspace">
      <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="block">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0 1 20 12c0 4.42-3.58 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="clear">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="content-copy">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="content-cut">
      <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="content-paste">
      <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="create">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="delete-sweep">
      <path d="M15 16h4v2h-4zm0-8h7v2h-7zm0 4h6v2h-6zM3 18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H3v10zM14 5h-3l-1-1H6L5 5H2v2h12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="drafts">
      <path d="M21.99 8c0-.72-.37-1.35-.94-1.7L12 1 2.95 6.3C2.38 6.65 2 7.28 2 8v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2l-.01-10zM12 13L3.74 7.84 12 3l8.26 4.84L12 13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-list">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flag">
      <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="font-download">
      <path d="M9.93 13.5h4.14L12 7.98zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5l-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="forward">
      <path d="M12 8V4l8 8-8 8v-4H4V8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gesture">
      <path d="M4.59 6.89c.7-.71 1.4-1.35 1.71-1.22.5.2 0 1.03-.3 1.52-.25.42-2.86 3.89-2.86 6.31 0 1.28.48 2.34 1.34 2.98.75.56 1.74.73 2.64.46 1.07-.31 1.95-1.4 3.06-2.77 1.21-1.49 2.83-3.44 4.08-3.44 1.63 0 1.65 1.01 1.76 1.79-3.78.64-5.38 3.67-5.38 5.37 0 1.7 1.44 3.09 3.21 3.09 1.63 0 4.29-1.33 4.69-6.1H21v-2.5h-2.47c-.15-1.65-1.09-4.2-4.03-4.2-2.25 0-4.18 1.91-4.94 2.84-.58.73-2.06 2.48-2.29 2.72-.25.3-.68.84-1.11.84-.45 0-.72-.83-.36-1.92.35-1.09 1.4-2.86 1.85-3.52.78-1.14 1.3-1.92 1.3-3.28C8.95 3.69 7.31 3 6.44 3 5.12 3 3.97 4 3.72 4.25c-.36.36-.66.66-.88.93l1.75 1.71zm9.29 11.66c-.31 0-.74-.26-.74-.72 0-.6.73-2.2 2.87-2.76-.3 2.69-1.43 3.48-2.13 3.48z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="inbox">
      <path d="M19 3H4.99c-1.11 0-1.98.89-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5a2 2 0 0 0-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="link">
      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="low-priority">
      <path d="M14 5h8v2h-8zm0 5.5h8v2h-8zm0 5.5h8v2h-8zM2 11.5C2 15.08 4.92 18 8.5 18H9v2l3-3-3-3v2h-.5C6.02 16 4 13.98 4 11.5S6.02 7 8.5 7H12V5H8.5C4.92 5 2 7.92 2 11.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mail">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="markunread">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="move-to-inbox">
      <path d="M19 3H4.99c-1.11 0-1.98.9-1.98 2L3 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10zm-3-5h-2V7h-4v3H8l4 4 4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="next-week">
      <path d="M20 7h-4V5c0-.55-.22-1.05-.59-1.41C15.05 3.22 14.55 3 14 3h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 5h4v2h-4V5zm1 13.5l-1-1 3-3-3-3 1-1 4 4-4 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="redo">
      <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16a8.002 8.002 0 0 1 7.6-5.5c1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="remove">
      <path d="M19 13H5v-2h14v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="remove-circle">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="remove-circle-outline">
      <path d="M7 11v2h10v-2H7zm5-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="reply">
      <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="reply-all">
      <path d="M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="report">
      <path d="M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM12 17.3c-.72 0-1.3-.58-1.3-1.3 0-.72.58-1.3 1.3-1.3.72 0 1.3.58 1.3 1.3 0 .72-.58 1.3-1.3 1.3zm1-4.3h-2V7h2v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="save">
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="select-all">
      <path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="send">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sort">
      <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="text-format">
      <path d="M5 17v2h14v-2H5zm4.5-4.2h5l.9 2.2h2.1L12.75 4h-1.5L6.5 15h2.1l.9-2.2zM12 5.98L13.87 11h-3.74L12 5.98z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="unarchive">
      <path d="M20.55 5.22l-1.39-1.68A1.51 1.51 0 0 0 18 3H6c-.47 0-.88.21-1.15.55L3.46 5.22C3.17 5.57 3 6.01 3 6.5V19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6.5c0-.49-.17-.93-.45-1.28zM12 9.5l5.5 5.5H14v2h-4v-2H6.5L12 9.5zM5.12 5l.82-1h12l.93 1H5.12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="undo">
      <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="weekend">
      <path d="M21 10c-1.1 0-2 .9-2 2v3H5v-3c0-1.1-.9-2-2-2s-2 .9-2 2v5c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2v-5c0-1.1-.9-2-2-2zm-3-5H6c-1.1 0-2 .9-2 2v2.15c1.16.41 2 1.51 2 2.82V14h12v-2.03c0-1.3.84-2.4 2-2.82V7c0-1.1-.9-2-2-2z"/>
    </symbol>
  </g>
  <g data-category="device">
    <symbol viewBox="0 0 24 24" id="access-alarm">
      <path d="M22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM12.5 8H11v6l4.75 2.85.75-1.23-4-2.37V8zM12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a9 9 0 0 0 0-18zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="access-alarms">
      <path d="M22 5.7l-4.6-3.9-1.3 1.5 4.6 3.9L22 5.7zM7.9 3.4L6.6 1.9 2 5.7l1.3 1.5 4.6-3.8zM12.5 8H11v6l4.7 2.9.8-1.2-4-2.4V8zM12 4c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm0 16c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="access-time">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="add-alarm">
      <path d="M7.88 3.39L6.6 1.86 2 5.71l1.29 1.53 4.59-3.85zM22 5.72l-4.6-3.86-1.29 1.53 4.6 3.86L22 5.72zM12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a9 9 0 0 0 0-18zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airplanemode-active">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airplanemode-inactive">
      <path d="M13 9V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5v3.68l7.83 7.83L21 16v-2l-8-5zM3 5.27l4.99 4.99L2 14v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-3.73L18.73 21 20 19.73 4.27 4 3 5.27z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-20">
      <path d="M7 17v3.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V17H7z"/>
      <path fill-opacity=".3" d="M17 5.33C17 4.6 16.4 4 15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V17h10V5.33z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-30">
      <path fill-opacity=".3" d="M17 5.33C17 4.6 16.4 4 15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V15h10V5.33z"/>
      <path d="M7 15v5.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V15H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-50">
      <path fill-opacity=".3" d="M17 5.33C17 4.6 16.4 4 15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V13h10V5.33z"/>
      <path d="M7 13v7.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V13H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-60">
      <path fill-opacity=".3" d="M17 5.33C17 4.6 16.4 4 15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V11h10V5.33z"/>
      <path d="M7 11v9.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V11H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-80">
      <path fill-opacity=".3" d="M17 5.33C17 4.6 16.4 4 15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V9h10V5.33z"/>
      <path d="M7 9v11.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V9H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-90">
      <path fill-opacity=".3" d="M17 5.33C17 4.6 16.4 4 15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V8h10V5.33z"/>
      <path d="M7 8v12.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V8H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-alert">
      <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zM13 18h-2v-2h2v2zm0-4h-2V9h2v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-charging-20">
      <path d="M11 20v-3H7v3.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V17h-4.4L11 20z"/>
      <path fill-opacity=".3" d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V17h4v-2.5H9L13 7v5.5h2L12.6 17H17V5.33C17 4.6 16.4 4 15.67 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-charging-30">
      <path fill-opacity=".3" d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v9.17h2L13 7v5.5h2l-1.07 2H17V5.33C17 4.6 16.4 4 15.67 4z"/>
      <path d="M11 20v-5.5H7v6.17C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V14.5h-3.07L11 20z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-charging-50">
      <path d="M14.47 13.5L11 20v-5.5H9l.53-1H7v7.17C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V13.5h-2.53z"/>
      <path fill-opacity=".3" d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v8.17h2.53L13 7v5.5h2l-.53 1H17V5.33C17 4.6 16.4 4 15.67 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-charging-60">
      <path fill-opacity=".3" d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V11h3.87L13 7v4h4V5.33C17 4.6 16.4 4 15.67 4z"/>
      <path d="M13 12.5h2L11 20v-5.5H9l1.87-3.5H7v9.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V11h-4v1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-charging-80">
      <path fill-opacity=".3" d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V9h4.93L13 7v2h4V5.33C17 4.6 16.4 4 15.67 4z"/>
      <path d="M13 12.5h2L11 20v-5.5H9L11.93 9H7v11.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V9h-4v3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-charging-90">
      <path fill-opacity=".3" d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33V8h5.47L13 7v1h4V5.33C17 4.6 16.4 4 15.67 4z"/>
      <path d="M13 12.5h2L11 20v-5.5H9L12.47 8H7v12.67C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V8h-4v4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-charging-full">
      <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zM11 20v-5.5H9L13 7v5.5h2L11 20z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-full">
      <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-std">
      <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="battery-unknown">
      <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zm-2.72 13.95h-1.9v-1.9h1.9v1.9zm1.35-5.26s-.38.42-.67.71c-.48.48-.83 1.15-.83 1.6h-1.6c0-.83.46-1.52.93-2l.93-.94A1.498 1.498 0 0 0 12 9.5c-.83 0-1.5.67-1.5 1.5H9c0-1.66 1.34-3 3-3s3 1.34 3 3c0 .66-.27 1.26-.7 1.69z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bluetooth">
      <path d="M17.71 7.71L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bluetooth-connected">
      <path d="M7 12l-2-2-2 2 2 2 2-2zm10.71-4.29L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88zM19 10l-2 2 2 2 2-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bluetooth-disabled">
      <path d="M13 5.83l1.88 1.88-1.6 1.6 1.41 1.41 3.02-3.02L12 2h-1v5.03l2 2v-3.2zM5.41 4L4 5.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l4.29-4.29 2.3 2.29L20 18.59 5.41 4zM13 18.17v-3.76l1.88 1.88L13 18.17z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bluetooth-searching">
      <path d="M14.24 12.01l2.32 2.32c.28-.72.44-1.51.44-2.33 0-.82-.16-1.59-.43-2.31l-2.33 2.32zm5.29-5.3l-1.26 1.26c.63 1.21.98 2.57.98 4.02s-.36 2.82-.98 4.02l1.2 1.2a9.936 9.936 0 0 0 1.54-5.31c-.01-1.89-.55-3.67-1.48-5.19zm-3.82 1L10 2H9v7.59L4.41 5 3 6.41 8.59 12 3 17.59 4.41 19 9 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM11 5.83l1.88 1.88L11 9.59V5.83zm1.88 10.46L11 18.17v-3.76l1.88 1.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-auto">
      <path d="M10.85 12.65h2.3L12 9l-1.15 3.65zM20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM14.3 16l-.7-2h-3.2l-.7 2H7.8L11 7h2l3.2 9h-1.9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-high">
      <path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-low">
      <path d="M20 15.31L23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-medium">
      <path d="M20 15.31L23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18V6c3.31 0 6 2.69 6 6s-2.69 6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="data-usage">
      <path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.48 2.54l2.6 1.53c.56-1.24.88-2.62.88-4.07 0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.06.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53A6.95 6.95 0 0 1 12 19z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="developer-mode">
      <path d="M7 5h10v2h2V3c0-1.1-.9-1.99-2-1.99L7 1c-1.1 0-2 .9-2 2v4h2V5zm8.41 11.59L20 12l-4.59-4.59L14 8.83 17.17 12 14 15.17l1.41 1.42zM10 15.17L6.83 12 10 8.83 8.59 7.41 4 12l4.59 4.59L10 15.17zM17 19H7v-2H5v4c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2v-4h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="devices">
      <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="dvr">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zm-2-9H8v2h11V8zm0 4H8v2h11v-2zM7 8H5v2h2V8zm0 4H5v2h2v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gps-fixed">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gps-not-fixed">
      <path d="M20.94 11A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gps-off">
      <path d="M20.94 11A8.994 8.994 0 0 0 13 3.06V1h-2v2.06c-1.13.12-2.19.46-3.16.97l1.5 1.5A6.995 6.995 0 0 1 19 12c0 .94-.19 1.84-.52 2.65l1.5 1.5c.5-.96.84-2.02.97-3.15H23v-2h-2.06zM3 4.27l2.04 2.04A8.914 8.914 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06c1.77-.2 3.38-.91 4.69-1.98L19.73 21 21 19.73 4.27 3 3 4.27zm13.27 13.27a6.995 6.995 0 0 1-9.81-9.81l9.81 9.81z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="graphic-eq">
      <path d="M7 18h2V6H7v12zm4 4h2V2h-2v20zm-8-8h2v-4H3v4zm12 4h2V6h-2v12zm4-8v4h2v-4h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="location-disabled">
      <path d="M20.94 11A8.994 8.994 0 0 0 13 3.06V1h-2v2.06c-1.13.12-2.19.46-3.16.97l1.5 1.5A6.995 6.995 0 0 1 19 12c0 .94-.19 1.84-.52 2.65l1.5 1.5c.5-.96.84-2.02.97-3.15H23v-2h-2.06zM3 4.27l2.04 2.04A8.914 8.914 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06c1.77-.2 3.38-.91 4.69-1.98L19.73 21 21 19.73 4.27 3 3 4.27zm13.27 13.27a6.995 6.995 0 0 1-9.81-9.81l9.81 9.81z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="location-searching">
      <path d="M20.94 11A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="network-cell">
      <path fill-opacity=".3" d="M2 22h20V2z"/>
      <path d="M17 7L2 22h15z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="network-wifi">
      <path fill-opacity=".3" d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
      <path d="M3.53 10.95l8.46 10.54.01.01.01-.01 8.46-10.54C20.04 10.62 16.81 8 12 8c-4.81 0-8.04 2.62-8.47 2.95z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="nfc">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H4V4h16v16zM18 6h-5c-1.1 0-2 .9-2 2v2.28c-.6.35-1 .98-1 1.72 0 1.1.9 2 2 2s2-.9 2-2c0-.74-.4-1.38-1-1.72V8h3v8H8V8h2V6H6v12h12V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="screen-lock-landscape">
      <path d="M21 5H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-2 12H5V7h14v10zm-9-1h4c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1v-1a2 2 0 1 0-4 0v1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1zm.8-6c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2v1h-2.4v-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="screen-lock-portrait">
      <path d="M10 16h4c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1v-1a2 2 0 1 0-4 0v1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1zm.8-6c0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2v1h-2.4v-1zM17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="screen-lock-rotation">
      <path d="M23.25 12.77l-2.57-2.57-1.41 1.41 2.22 2.22-5.66 5.66L4.51 8.17l5.66-5.66 2.1 2.1 1.41-1.41L11.23.75a1.49 1.49 0 0 0-2.12 0L2.75 7.11a1.49 1.49 0 0 0 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12zM8.47 20.48A10.487 10.487 0 0 1 2.5 12H1c.51 6.16 5.66 11 11.95 11l.66-.03-3.81-3.82-1.33 1.33zM16 9h5c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1v-.5a2.5 2.5 0 0 0-5 0V3c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1zm.8-6.5c0-.94.76-1.7 1.7-1.7s1.7.76 1.7 1.7V3h-3.4v-.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="screen-rotation">
      <path d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77a1.49 1.49 0 0 0-2.12 0L1.75 8.11a1.49 1.49 0 0 0 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29A10.487 10.487 0 0 1 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sd-storage">
      <path d="M18 2h-8L4.02 8 4 20c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 6h-2V4h2v4zm3 0h-2V4h2v4zm3 0h-2V4h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="settings-system-daydream">
      <path d="M9 16h6.5a2.5 2.5 0 0 0 0-5h-.05c-.24-1.69-1.69-3-3.45-3-1.4 0-2.6.83-3.16 2.02h-.16A2.994 2.994 0 0 0 6 13c0 1.66 1.34 3 3 3zM21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-0-bar">
      <path fill-opacity=".3" d="M2 22h20V2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-1-bar">
      <path fill-opacity=".3" d="M2 22h20V2z"/>
      <path d="M12 12L2 22h10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-2-bar">
      <path fill-opacity=".3" d="M2 22h20V2z"/>
      <path d="M14 10L2 22h12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-3-bar">
      <path fill-opacity=".3" d="M2 22h20V2z"/>
      <path d="M17 7L2 22h15z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-4-bar">
      <path d="M2 22h20V2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-connected-no-internet-0-bar">
      <path fill-opacity=".3" d="M22 8V2L2 22h16V8z"/>
      <path d="M20 22h2v-2h-2v2zm0-12v8h2v-8h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-connected-no-internet-1-bar">
      <path fill-opacity=".3" d="M22 8V2L2 22h16V8z"/>
      <path d="M20 10v8h2v-8h-2zm-8 12V12L2 22h10zm8 0h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-connected-no-internet-2-bar">
      <path fill-opacity=".3" d="M22 8V2L2 22h16V8z"/>
      <path d="M14 22V10L2 22h12zm6-12v8h2v-8h-2zm0 12h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-connected-no-internet-3-bar">
      <path fill-opacity=".3" d="M22 8V2L2 22h16V8z"/>
      <path d="M17 22V7L2 22h15zm3-12v8h2v-8h-2zm0 12h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-connected-no-internet-4-bar">
      <path d="M20 18h2v-8h-2v8zm0 4h2v-2h-2v2zM2 22h16V8h4V2L2 22z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-no-sim">
      <path d="M18.99 5c0-1.1-.89-2-1.99-2h-7L7.66 5.34 19 16.68 18.99 5zM3.65 3.88L2.38 5.15 5 7.77V19c0 1.1.9 2 2 2h10.01c.35 0 .67-.1.96-.26l1.88 1.88 1.27-1.27L3.65 3.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-null">
      <path d="M20 6.83V20H6.83L20 6.83M22 2L2 22h20V2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-cellular-off">
      <path d="M21 1l-8.59 8.59L21 18.18V1zM4.77 4.5L3.5 5.77l6.36 6.36L1 21h17.73l2 2L22 21.73 4.77 4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-0-bar">
      <path fill-opacity=".3" d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-1-bar">
      <path fill-opacity=".3" d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
      <path d="M6.67 14.86L12 21.49v.01l.01-.01 5.33-6.63C17.06 14.65 15.03 13 12 13s-5.06 1.65-5.33 1.86z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-1-bar-lock">
      <path d="M23 16v-1.5c0-1.4-1.1-2.5-2.5-2.5S18 13.1 18 14.5V16c-.5 0-1 .5-1 1v4c0 .5.5 1 1 1h5c.5 0 1-.5 1-1v-4c0-.5-.5-1-1-1zm-1 0h-3v-1.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V16z"/>
      <path d="M15.5 14.5c0-2.8 2.2-5 5-5 .4 0 .7 0 1 .1L23.6 7c-.4-.3-4.9-4-11.6-4C5.3 3 .8 6.7.4 7L12 21.5l3.5-4.3v-2.7z" opacity=".3"/>
      <path d="M6.7 14.9l5.3 6.6 3.5-4.3v-2.6c0-.2 0-.5.1-.7-.9-.5-2.2-.9-3.6-.9-3 0-5.1 1.7-5.3 1.9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-2-bar">
      <path fill-opacity=".3" d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
      <path d="M4.79 12.52l7.2 8.98H12l.01-.01 7.2-8.98C18.85 12.24 16.1 10 12 10s-6.85 2.24-7.21 2.52z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-2-bar-lock">
      <path d="M23 16v-1.5c0-1.4-1.1-2.5-2.5-2.5S18 13.1 18 14.5V16c-.5 0-1 .5-1 1v4c0 .5.5 1 1 1h5c.5 0 1-.5 1-1v-4c0-.5-.5-1-1-1zm-1 0h-3v-1.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V16z"/>
      <path d="M15.5 14.5c0-2.8 2.2-5 5-5 .4 0 .7 0 1 .1L23.6 7c-.4-.3-4.9-4-11.6-4C5.3 3 .8 6.7.4 7L12 21.5l3.5-4.3v-2.7z" opacity=".3"/>
      <path d="M4.8 12.5l7.2 9 3.5-4.4v-2.6c0-1.3.5-2.5 1.4-3.4C15.6 10.5 14 10 12 10c-4.1 0-6.8 2.2-7.2 2.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-3-bar">
      <path fill-opacity=".3" d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
      <path d="M3.53 10.95l8.46 10.54.01.01.01-.01 8.46-10.54C20.04 10.62 16.81 8 12 8c-4.81 0-8.04 2.62-8.47 2.95z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-3-bar-lock">
      <path opacity=".3" d="M12 3C5.3 3 .8 6.7.4 7l3.2 3.9L12 21.5l3.5-4.3v-2.6c0-2.2 1.4-4 3.3-4.7.3-.1.5-.2.8-.2.3-.1.6-.1.9-.1.4 0 .7 0 1 .1L23.6 7c-.4-.3-4.9-4-11.6-4z"/>
      <path d="M23 16v-1.5c0-1.4-1.1-2.5-2.5-2.5S18 13.1 18 14.5V16c-.5 0-1 .5-1 1v4c0 .5.5 1 1 1h5c.5 0 1-.5 1-1v-4c0-.5-.5-1-1-1zm-1 0h-3v-1.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V16zm-10 5.5l3.5-4.3v-2.6c0-2.2 1.4-4 3.3-4.7C17.3 9 14.9 8 12 8c-4.8 0-8 2.6-8.5 2.9"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-4-bar">
      <path d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-4-bar-lock">
      <path d="M23 16v-1.5c0-1.4-1.1-2.5-2.5-2.5S18 13.1 18 14.5V16c-.5 0-1 .5-1 1v4c0 .5.5 1 1 1h5c.5 0 1-.5 1-1v-4c0-.5-.5-1-1-1zm-1 0h-3v-1.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5V16zm-6.5-1.5c0-2.8 2.2-5 5-5 .4 0 .7 0 1 .1L23.6 7c-.4-.3-4.9-4-11.6-4C5.3 3 .8 6.7.4 7L12 21.5l3.5-4.4v-2.6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="signal-wifi-off">
      <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="storage">
      <path d="M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="usb">
      <path d="M15 7v4h1v2h-3V5h2l-3-4-3 4h2v8H8v-2.07c.7-.37 1.2-1.08 1.2-1.93 0-1.21-.99-2.2-2.2-2.2-1.21 0-2.2.99-2.2 2.2 0 .85.5 1.56 1.2 1.93V13c0 1.11.89 2 2 2h3v3.05c-.71.37-1.2 1.1-1.2 1.95a2.2 2.2 0 0 0 4.4 0c0-.85-.49-1.58-1.2-1.95V15h3c1.11 0 2-.89 2-2v-2h1V7h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wallpaper">
      <path d="M4 4h7V2H4c-1.1 0-2 .9-2 2v7h2V4zm6 9l-4 5h12l-3-4-2.03 2.71L10 13zm7-4.5c0-.83-.67-1.5-1.5-1.5S14 7.67 14 8.5s.67 1.5 1.5 1.5S17 9.33 17 8.5zM20 2h-7v2h7v7h2V4c0-1.1-.9-2-2-2zm0 18h-7v2h7c1.1 0 2-.9 2-2v-7h-2v7zM4 13H2v7c0 1.1.9 2 2 2h7v-2H4v-7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="widgets">
      <path d="M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wifi-lock">
      <path d="M20.5 9.5c.28 0 .55.04.81.08L24 6c-3.34-2.51-7.5-4-12-4S3.34 3.49 0 6l12 16 3.5-4.67V14.5c0-2.76 2.24-5 5-5zM23 16v-1.5a2.5 2.5 0 0 0-5 0V16c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h5c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1zm-1 0h-3v-1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wifi-tethering">
      <path d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 2c0-3.31-2.69-6-6-6s-6 2.69-6 6c0 2.22 1.21 4.15 3 5.19l1-1.74c-1.19-.7-2-1.97-2-3.45 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.48-.81 2.75-2 3.45l1 1.74c1.79-1.04 3-2.97 3-5.19zM12 3C6.48 3 2 7.48 2 13c0 3.7 2.01 6.92 4.99 8.65l1-1.73C5.61 18.53 4 15.96 4 13c0-4.42 3.58-8 8-8s8 3.58 8 8c0 2.96-1.61 5.53-4 6.92l1 1.73c2.99-1.73 5-4.95 5-8.65 0-5.52-4.48-10-10-10z"/>
    </symbol>
  </g>
  <g data-category="editor">
    <symbol viewBox="0 0 24 24" id="attach-file">
      <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="attach-money">
      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-all">
      <path d="M3 3v18h18V3H3zm8 16H5v-6h6v6zm0-8H5V5h6v6zm8 8h-6v-6h6v6zm0-8h-6V5h6v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-bottom">
      <path d="M9 11H7v2h2v-2zm4 4h-2v2h2v-2zM9 3H7v2h2V3zm4 8h-2v2h2v-2zM5 3H3v2h2V3zm8 4h-2v2h2V7zm4 4h-2v2h2v-2zm-4-8h-2v2h2V3zm4 0h-2v2h2V3zm2 10h2v-2h-2v2zm0 4h2v-2h-2v2zM5 7H3v2h2V7zm14-4v2h2V3h-2zm0 6h2V7h-2v2zM5 11H3v2h2v-2zM3 21h18v-2H3v2zm2-6H3v2h2v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-clear">
      <path d="M7 5h2V3H7v2zm0 8h2v-2H7v2zm0 8h2v-2H7v2zm4-4h2v-2h-2v2zm0 4h2v-2h-2v2zm-8 0h2v-2H3v2zm0-4h2v-2H3v2zm0-4h2v-2H3v2zm0-4h2V7H3v2zm0-4h2V3H3v2zm8 8h2v-2h-2v2zm8 4h2v-2h-2v2zm0-4h2v-2h-2v2zm0 8h2v-2h-2v2zm0-12h2V7h-2v2zm-8 0h2V7h-2v2zm8-6v2h2V3h-2zm-8 2h2V3h-2v2zm4 16h2v-2h-2v2zm0-8h2v-2h-2v2zm0-8h2V3h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-color">
      <path d="M17.75 7L14 3.25l-10 10V17h3.75l10-10zm2.96-2.96a.996.996 0 0 0 0-1.41L18.37.29a.996.996 0 0 0-1.41 0L15 2.25 18.75 6l1.96-1.96z"/>
      <path fill-opacity=".36" d="M0 20h24v4H0z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-horizontal">
      <path d="M3 21h2v-2H3v2zM5 7H3v2h2V7zM3 17h2v-2H3v2zm4 4h2v-2H7v2zM5 3H3v2h2V3zm4 0H7v2h2V3zm8 0h-2v2h2V3zm-4 4h-2v2h2V7zm0-4h-2v2h2V3zm6 14h2v-2h-2v2zm-8 4h2v-2h-2v2zm-8-8h18v-2H3v2zM19 3v2h2V3h-2zm0 6h2V7h-2v2zm-8 8h2v-2h-2v2zm4 4h2v-2h-2v2zm4 0h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-inner">
      <path d="M3 21h2v-2H3v2zm4 0h2v-2H7v2zM5 7H3v2h2V7zM3 17h2v-2H3v2zM9 3H7v2h2V3zM5 3H3v2h2V3zm12 0h-2v2h2V3zm2 6h2V7h-2v2zm0-6v2h2V3h-2zm-4 18h2v-2h-2v2zM13 3h-2v8H3v2h8v8h2v-8h8v-2h-8V3zm6 18h2v-2h-2v2zm0-4h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-left">
      <path d="M11 21h2v-2h-2v2zm0-4h2v-2h-2v2zm0-12h2V3h-2v2zm0 4h2V7h-2v2zm0 4h2v-2h-2v2zm-4 8h2v-2H7v2zM7 5h2V3H7v2zm0 8h2v-2H7v2zm-4 8h2V3H3v18zM19 9h2V7h-2v2zm-4 12h2v-2h-2v2zm4-4h2v-2h-2v2zm0-14v2h2V3h-2zm0 10h2v-2h-2v2zm0 8h2v-2h-2v2zm-4-8h2v-2h-2v2zm0-8h2V3h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-outer">
      <path d="M13 7h-2v2h2V7zm0 4h-2v2h2v-2zm4 0h-2v2h2v-2zM3 3v18h18V3H3zm16 16H5V5h14v14zm-6-4h-2v2h2v-2zm-4-4H7v2h2v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-right">
      <path d="M7 21h2v-2H7v2zM3 5h2V3H3v2zm4 0h2V3H7v2zm0 8h2v-2H7v2zm-4 8h2v-2H3v2zm8 0h2v-2h-2v2zm-8-8h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm8 8h2v-2h-2v2zm4-4h2v-2h-2v2zm4-10v18h2V3h-2zm-4 18h2v-2h-2v2zm0-16h2V3h-2v2zm-4 8h2v-2h-2v2zm0-8h2V3h-2v2zm0 4h2V7h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-style">
      <path d="M15 21h2v-2h-2v2zm4 0h2v-2h-2v2zM7 21h2v-2H7v2zm4 0h2v-2h-2v2zm8-4h2v-2h-2v2zm0-4h2v-2h-2v2zM3 3v18h2V5h16V3H3zm16 6h2V7h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-top">
      <path d="M7 21h2v-2H7v2zm0-8h2v-2H7v2zm4 0h2v-2h-2v2zm0 8h2v-2h-2v2zm-8-4h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2v-2H3v2zm0-4h2V7H3v2zm8 8h2v-2h-2v2zm8-8h2V7h-2v2zm0 4h2v-2h-2v2zM3 3v2h18V3H3zm16 14h2v-2h-2v2zm-4 4h2v-2h-2v2zM11 9h2V7h-2v2zm8 12h2v-2h-2v2zm-4-8h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="border-vertical">
      <path d="M3 9h2V7H3v2zm0-4h2V3H3v2zm4 16h2v-2H7v2zm0-8h2v-2H7v2zm-4 0h2v-2H3v2zm0 8h2v-2H3v2zm0-4h2v-2H3v2zM7 5h2V3H7v2zm12 12h2v-2h-2v2zm-8 4h2V3h-2v18zm8 0h2v-2h-2v2zm0-8h2v-2h-2v2zm0-10v2h2V3h-2zm0 6h2V7h-2v2zm-4-4h2V3h-2v2zm0 16h2v-2h-2v2zm0-8h2v-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bubble-chart">
      <circle cx="7.2" cy="14.4" r="3.2"/>
      <circle cx="14.8" cy="18" r="2"/>
      <circle cx="15.2" cy="8.8" r="4.8"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="drag-handle">
      <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-align-center">
      <path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-align-justify">
      <path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-align-left">
      <path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-align-right">
      <path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-bold">
      <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-clear">
      <path d="M3.27 5L2 6.27l6.97 6.97L6.5 19h3l1.57-3.66L16.73 21 18 19.73 3.55 5.27 3.27 5zM6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-color-fill">
      <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15a1.49 1.49 0 0 0 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/>
      <path fill-opacity=".36" d="M0 20h24v4H0z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-color-reset">
      <path d="M18 14c0-4-6-10.8-6-10.8s-1.33 1.51-2.73 3.52l8.59 8.59c.09-.42.14-.86.14-1.31zm-.88 3.12L12.5 12.5 5.27 5.27 4 6.55l3.32 3.32C6.55 11.32 6 12.79 6 14c0 3.31 2.69 6 6 6 1.52 0 2.9-.57 3.96-1.5l2.63 2.63 1.27-1.27-2.74-2.74z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-color-text">
      <path fill-opacity=".36" d="M0 20h24v4H0z"/>
      <path d="M11 3L5.5 17h2.25l1.12-3h6.25l1.12 3h2.25L13 3h-2zm-1.38 9L12 5.67 14.38 12H9.62z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-indent-decrease">
      <path d="M11 17h10v-2H11v2zm-8-5l4 4V8l-4 4zm0 9h18v-2H3v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-indent-increase">
      <path d="M3 21h18v-2H3v2zM3 8v8l4-4-4-4zm8 9h10v-2H11v2zM3 3v2h18V3H3zm8 6h10V7H11v2zm0 4h10v-2H11v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-italic">
      <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-line-spacing">
      <path d="M6 7h2.5L5 3.5 1.5 7H4v10H1.5L5 20.5 8.5 17H6V7zm4-2v2h12V5H10zm0 14h12v-2H10v2zm0-6h12v-2H10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-list-bulleted">
      <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-list-numbered">
      <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-paint">
      <path d="M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4h-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-quote">
      <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-shapes">
      <path d="M23 7V1h-6v2H7V1H1v6h2v10H1v6h6v-2h10v2h6v-6h-2V7h2zM3 3h2v2H3V3zm2 18H3v-2h2v2zm12-2H7v-2H5V7h2V5h10v2h2v10h-2v2zm4 2h-2v-2h2v2zM19 5V3h2v2h-2zm-5.27 9h-3.49l-.73 2H7.89l3.4-9h1.4l3.41 9h-1.63l-.74-2zm-3.04-1.26h2.61L12 8.91l-1.31 3.83z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-size">
      <path d="M9 4v3h5v12h3V7h5V4H9zm-6 8h3v7h3v-7h3V9H3v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-strikethrough">
      <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-textdirection-l-to-r">
      <path d="M9 10v5h2V4h2v11h2V4h2V2H9C6.79 2 5 3.79 5 6s1.79 4 4 4zm12 8l-4-4v3H5v2h12v3l4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-textdirection-r-to-l">
      <path d="M10 10v5h2V4h2v11h2V4h2V2h-8C7.79 2 6 3.79 6 6s1.79 4 4 4zm-2 7v-3l-4 4 4 4v-3h12v-2H8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="format-underlined">
      <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="functions">
      <path d="M18 4H6v2l6.5 6L6 18v2h12v-3h-7l5-5-5-5h7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="highlight">
      <path d="M6 14l3 3v5h6v-5l3-3V9H6zm5-12h2v3h-2zM3.5 5.875L4.914 4.46l2.12 2.122L5.62 7.997zm13.46.71l2.123-2.12 1.414 1.414L18.375 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="insert-chart">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="insert-comment">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="insert-drive-file">
      <path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="insert-emoticon">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="insert-invitation">
      <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="insert-link">
      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="insert-photo">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="linear-scale">
      <path d="M19.5 9.5c-1.03 0-1.9.62-2.29 1.5h-2.92c-.39-.88-1.26-1.5-2.29-1.5s-1.9.62-2.29 1.5H6.79c-.39-.88-1.26-1.5-2.29-1.5a2.5 2.5 0 0 0 0 5c1.03 0 1.9-.62 2.29-1.5h2.92c.39.88 1.26 1.5 2.29 1.5s1.9-.62 2.29-1.5h2.92c.39.88 1.26 1.5 2.29 1.5a2.5 2.5 0 0 0 0-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="merge-type">
      <path d="M17 20.41L18.41 19 15 15.59 13.59 17 17 20.41zM7.5 8H11v5.59L5.59 19 7 20.41l6-6V8h3.5L12 3.5 7.5 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mode-comment">
      <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mode-edit">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="monetization-on">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="money-off">
      <path d="M12.5 6.9c1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-.53.12-1.03.3-1.48.54l1.47 1.47c.41-.17.91-.27 1.51-.27zM5.33 4.06L4.06 5.33 7.5 8.77c0 2.08 1.56 3.21 3.91 3.91l3.51 3.51c-.34.48-1.05.91-2.42.91-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c.96-.18 1.82-.55 2.45-1.12l2.22 2.22 1.27-1.27L5.33 4.06z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="multiline-chart">
      <path d="M22 6.92l-1.41-1.41-2.85 3.21C15.68 6.4 12.83 5 9.61 5 6.72 5 4.07 6.16 2 8l1.42 1.42C5.12 7.93 7.27 7 9.61 7c2.74 0 5.09 1.26 6.77 3.24l-2.88 3.24-4-4L2 16.99l1.5 1.5 6-6.01 4 4 4.05-4.55c.75 1.35 1.25 2.9 1.44 4.55H21c-.22-2.3-.95-4.39-2.04-6.14L22 6.92z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pie-chart">
      <path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pie-chart-outlined">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 2.07c3.61.45 6.48 3.33 6.93 6.93H13V4.07zM4 12c0-4.06 3.07-7.44 7-7.93v15.87c-3.93-.5-7-3.88-7-7.94zm9 7.93V13h6.93A8.002 8.002 0 0 1 13 19.93z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="publish">
      <path d="M5 4v2h14V4H5zm0 10h4v6h6v-6h4l-7-7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="short-text">
      <path d="M4 9h16v2H4zm0 4h10v2H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="show-chart">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="space-bar">
      <path d="M18 9v4H6V9H4v6h16V9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="strikethrough-s">
      <path d="M7.24 8.75c-.26-.48-.39-1.03-.39-1.67 0-.61.13-1.16.4-1.67.26-.5.63-.93 1.11-1.29a5.73 5.73 0 0 1 1.7-.83c.66-.19 1.39-.29 2.18-.29.81 0 1.54.11 2.21.34.66.22 1.23.54 1.69.94.47.4.83.88 1.08 1.43.25.55.38 1.15.38 1.81h-3.01c0-.31-.05-.59-.15-.85-.09-.27-.24-.49-.44-.68-.2-.19-.45-.33-.75-.44-.3-.1-.66-.16-1.06-.16-.39 0-.74.04-1.03.13-.29.09-.53.21-.72.36-.19.16-.34.34-.44.55-.1.21-.15.43-.15.66 0 .48.25.88.74 1.21.38.25.77.48 1.41.7H7.39c-.05-.08-.11-.17-.15-.25zM21 12v-2H3v2h9.62c.18.07.4.14.55.2.37.17.66.34.87.51.21.17.35.36.43.57.07.2.11.43.11.69 0 .23-.05.45-.14.66-.09.2-.23.38-.42.53-.19.15-.42.26-.71.35-.29.08-.63.13-1.01.13-.43 0-.83-.04-1.18-.13s-.66-.23-.91-.42a1.92 1.92 0 0 1-.59-.75c-.14-.31-.25-.76-.25-1.21H6.4c0 .55.08 1.13.24 1.58.16.45.37.85.65 1.21.28.35.6.66.98.92.37.26.78.48 1.22.65.44.17.9.3 1.38.39.48.08.96.13 1.44.13.8 0 1.53-.09 2.18-.28s1.21-.45 1.67-.79c.46-.34.82-.77 1.07-1.27s.38-1.07.38-1.71c0-.6-.1-1.14-.31-1.61-.05-.11-.11-.23-.17-.33H21z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="text-fields">
      <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="title">
      <path d="M5 4v3h5.5v12h3V7H19V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="vertical-align-bottom">
      <path d="M16 13h-3V3h-2v10H8l4 4 4-4zM4 19v2h16v-2H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="vertical-align-center">
      <path d="M8 19h3v4h2v-4h3l-4-4-4 4zm8-14h-3V1h-2v4H8l4 4 4-4zM4 11v2h16v-2H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="vertical-align-top">
      <path d="M8 11h3v10h2V11h3l-4-4-4 4zM4 3v2h16V3H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wrap-text">
      <path d="M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3 3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"/>
    </symbol>
  </g>
  <g data-category="file">
    <symbol viewBox="0 0 24 24" id="attachment">
      <path d="M2 12.5C2 9.46 4.46 7 7.5 7H18c2.21 0 4 1.79 4 4s-1.79 4-4 4H9.5a2.5 2.5 0 0 1 0-5H17v2H9.41c-.55 0-.55 1 0 1H18c1.1 0 2-.9 2-2s-.9-2-2-2H7.5C5.57 9 4 10.57 4 12.5S5.57 16 7.5 16H17v2H7.5C4.46 18 2 15.54 2 12.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cloud">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cloud-circle">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14H8c-1.66 0-3-1.34-3-3s1.34-3 3-3l.14.01A3.98 3.98 0 0 1 12 7a4 4 0 0 1 4 4h.5a2.5 2.5 0 0 1 0 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cloud-done">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cloud-download">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cloud-off">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46a5.497 5.497 0 0 1 8.05 4.87v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cloud-queue">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h.71A5.5 5.5 0 0 1 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3s-1.34 3-3 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cloud-upload">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="create-new-folder">
      <path d="M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="file-download">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="file-upload">
      <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="folder">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="folder-open">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="folder-shared">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 8h-8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z"/>
    </symbol>
  </g>
  <g data-category="hardware">
    <symbol viewBox="0 0 24 24" id="cast">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2a9 9 0 0 1 9 9h2c0-6.08-4.93-11-11-11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cast-connected">
      <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2a9 9 0 0 1 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="computer">
      <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="desktop-mac">
      <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="desktop-windows">
      <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="developer-board">
      <path d="M22 9V7h-2V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2v-2h-2V9h2zm-4 10H4V5h14v14zM6 13h5v4H6zm6-6h4v3h-4zM6 7h5v5H6zm6 4h4v6h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="device-hub">
      <path d="M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v5h5v-3.05l4-4.2 4 4.2V21h5v-5h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="devices-other">
      <path d="M3 6h18V4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V6zm10 6H9v1.78c-.61.55-1 1.33-1 2.22s.39 1.67 1 2.22V20h4v-1.78c.61-.55 1-1.34 1-2.22s-.39-1.67-1-2.22V12zm-2 5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM22 8h-6c-.5 0-1 .5-1 1v10c0 .5.5 1 1 1h6c.5 0 1-.5 1-1V9c0-.5-.5-1-1-1zm-1 10h-4v-8h4v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="dock">
      <path d="M8 23h8v-2H8v2zm8-21.99L8 1c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM16 15H8V5h8v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gamepad">
      <path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="headset">
      <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7a9 9 0 0 0-9-9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="headset-mic">
      <path d="M12 1a9 9 0 0 0-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h4v1h-7v2h6c1.66 0 3-1.34 3-3V10a9 9 0 0 0-9-9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard">
      <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-arrow-down">
      <path d="M7.41 7.84L12 12.42l4.59-4.58L18 9.25l-6 6-6-6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-arrow-left">
      <path d="M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-arrow-right">
      <path d="M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-arrow-up">
      <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-backspace">
      <path d="M21 11H6.83l3.58-3.59L9 6l-6 6 6 6 1.41-1.41L6.83 13H21z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-capslock">
      <path d="M12 8.41L16.59 13 18 11.59l-6-6-6 6L7.41 13 12 8.41zM6 18h12v-2H6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-hide">
      <path d="M20 3H4c-1.1 0-1.99.9-1.99 2L2 15c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 3h2v2h-2V6zm0 3h2v2h-2V9zM8 6h2v2H8V6zm0 3h2v2H8V9zm-1 2H5V9h2v2zm0-3H5V6h2v2zm9 7H8v-2h8v2zm0-4h-2V9h2v2zm0-3h-2V6h2v2zm3 3h-2V9h2v2zm0-3h-2V6h2v2zm-7 15l4-4H8l4 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-return">
      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-tab">
      <path d="M11.59 7.41L15.17 11H1v2h14.17l-3.59 3.59L13 18l6-6-6-6-1.41 1.41zM20 6v12h2V6h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="keyboard-voice">
      <path d="M12 15c1.66 0 2.99-1.34 2.99-3L15 6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 15 6.7 12H5c0 3.42 2.72 6.23 6 6.72V22h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="laptop">
      <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="laptop-chromebook">
      <path d="M22 18V3H2v15H0v2h24v-2h-2zm-8 0h-4v-1h4v1zm6-3H4V5h16v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="laptop-mac">
      <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2H0c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2h-4zM4 5h16v11H4V5zm8 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="laptop-windows">
      <path d="M20 18v-1c1.1 0 1.99-.9 1.99-2L22 5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2v1H0v2h24v-2h-4zM4 5h16v10H4V5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="memory">
      <path d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mouse">
      <path d="M13 1.07V9h7c0-4.08-3.05-7.44-7-7.93zM4 15c0 4.42 3.58 8 8 8s8-3.58 8-8v-4H4v4zm7-13.93C7.05 1.56 4 4.92 4 9h7V1.07z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-android">
      <path d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-iphone">
      <path d="M15.5 1h-8A2.5 2.5 0 0 0 5 3.5v17A2.5 2.5 0 0 0 7.5 23h8a2.5 2.5 0 0 0 2.5-2.5v-17A2.5 2.5 0 0 0 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phonelink">
      <path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phonelink-off">
      <path d="M22 6V4H6.82l2 2H22zM1.92 1.65L.65 2.92l1.82 1.82C2.18 5.08 2 5.52 2 6v11H0v3h17.73l2.35 2.35 1.27-1.27L3.89 3.62 1.92 1.65zM4 6.27L14.73 17H4V6.27zM23 8h-6c-.55 0-1 .45-1 1v4.18l2 2V10h4v7h-2.18l3 3H23c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="power-input">
      <path d="M2 9v2h19V9H2zm0 6h5v-2H2v2zm7 0h5v-2H9v2zm7 0h5v-2h-5v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="router">
      <path d="M20.2 5.9l.8-.8C19.6 3.7 17.8 3 16 3s-3.6.7-5 2.1l.8.8C13 4.8 14.5 4.2 16 4.2s3 .6 4.2 1.7zm-.9.8c-.9-.9-2.1-1.4-3.3-1.4s-2.4.5-3.3 1.4l.8.8c.7-.7 1.6-1 2.5-1 .9 0 1.8.3 2.5 1l.8-.8zM19 13h-2V9h-2v4H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM8 18H6v-2h2v2zm3.5 0h-2v-2h2v2zm3.5 0h-2v-2h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="scanner">
      <path d="M19.8 10.7L4.2 5l-.7 1.9L17.6 12H5c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-5.5c0-.8-.5-1.6-1.2-1.8zM7 17H5v-2h2v2zm12 0H9v-2h10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="security">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sim-card">
      <path d="M19.99 4c0-1.1-.89-2-1.99-2h-8L4 8v12c0 1.1.9 2 2 2h12.01c1.1 0 1.99-.9 1.99-2l-.01-16zM9 19H7v-2h2v2zm8 0h-2v-2h2v2zm-8-4H7v-4h2v4zm4 4h-2v-4h2v4zm0-6h-2v-2h2v2zm4 2h-2v-4h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="smartphone">
      <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="speaker">
      <path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 1.99 2 1.99L17 22c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 2c1.1 0 2 .9 2 2s-.9 2-2 2a2 2 0 0 1 0-4zm0 16c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="speaker-group">
      <path d="M18.2 1H9.8C8.81 1 8 1.81 8 2.8v14.4c0 .99.81 1.79 1.8 1.79l8.4.01c.99 0 1.8-.81 1.8-1.8V2.8c0-.99-.81-1.8-1.8-1.8zM14 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 13.5c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
      <circle cx="14" cy="12.5" r="2.5"/>
      <path d="M6 5H4v16a2 2 0 0 0 2 2h10v-2H6V5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tablet">
      <path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 1.99-.9 1.99-2L23 6c0-1.1-.9-2-2-2zm-2 14H5V6h14v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tablet-android">
      <path d="M18 0H6C4.34 0 3 1.34 3 3v18c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V3c0-1.66-1.34-3-3-3zm-4 22h-4v-1h4v1zm5.25-3H4.75V3h14.5v16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tablet-mac">
      <path d="M18.5 0h-14A2.5 2.5 0 0 0 2 2.5v19A2.5 2.5 0 0 0 4.5 24h14a2.5 2.5 0 0 0 2.5-2.5v-19A2.5 2.5 0 0 0 18.5 0zm-7 23c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm7.5-4H4V3h15v16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="toys">
      <path d="M12 12c0-3 2.5-5.5 5.5-5.5S23 9 23 12H12zm0 0c0 3-2.5 5.5-5.5 5.5S1 15 1 12h11zm0 0c-3 0-5.5-2.5-5.5-5.5S9 1 12 1v11zm0 0c3 0 5.5 2.5 5.5 5.5S15 23 12 23V12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tv">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="videogame-asset">
      <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="watch">
      <path d="M20 12c0-2.54-1.19-4.81-3.04-6.27L16 0H8l-.95 5.73C5.19 7.19 4 9.45 4 12s1.19 4.81 3.05 6.27L8 24h8l.96-5.73A7.976 7.976 0 0 0 20 12zM6 12c0-3.31 2.69-6 6-6s6 2.69 6 6-2.69 6-6 6-6-2.69-6-6z"/>
    </symbol>
  </g>
  <g data-category="image">
    <symbol viewBox="0 0 24 24" id="add-a-photo">
      <path d="M3 4V1h2v3h3v2H5v3H3V6H0V4h3zm3 6V7h3V4h7l1.83 2H21c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V10h3zm7 9c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-3.2-5c0 1.77 1.43 3.2 3.2 3.2s3.2-1.43 3.2-3.2-1.43-3.2-3.2-3.2-3.2 1.43-3.2 3.2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="add-to-photos">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="adjust">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assistant">
      <path d="M19 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5.12 10.88L12 17l-1.88-4.12L6 11l4.12-1.88L12 5l1.88 4.12L18 11l-4.12 1.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="assistant-photo">
      <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="audiotrack">
      <path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="blur-circular">
      <path d="M10 9c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0 4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zM7 9.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm3 7c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm-3-3c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm3-6c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zM14 9c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0-1.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zm3 6c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm0-4c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm2-3.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm0-3.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="blur-linear">
      <path d="M5 17.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM9 13c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0-4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zM3 21h18v-2H3v2zM5 9.5c.83 0 1.5-.67 1.5-1.5S5.83 6.5 5 6.5 3.5 7.17 3.5 8 4.17 9.5 5 9.5zm0 4c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM9 17c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm8-.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zM3 3v2h18V3H3zm14 5.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zm0 4c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zM13 9c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="blur-off">
      <path d="M14 7c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-.2 4.48l.2.02c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5l.02.2c.09.67.61 1.19 1.28 1.28zM14 3.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zm-4 0c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zm11 7c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zM10 7c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm8 8c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0-4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0-4c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm-4 13.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zM2.5 5.27l3.78 3.78L6 9c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1c0-.1-.03-.19-.06-.28l2.81 2.81c-.71.11-1.25.73-1.25 1.47 0 .83.67 1.5 1.5 1.5.74 0 1.36-.54 1.47-1.25l2.81 2.81A.875.875 0 0 0 14 17c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1c0-.1-.03-.19-.06-.28l3.78 3.78L20 20.23 3.77 4 2.5 5.27zM10 17c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm11-3.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zM6 13c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zM3 9.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm7 11c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zM6 17c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-3-3.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="blur-on">
      <path d="M6 13c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0 4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0-8c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-3 .5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zM6 5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm15 5.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zM14 7c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0-3.5c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zm-11 10c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm7 7c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm0-17c.28 0 .5-.22.5-.5s-.22-.5-.5-.5-.5.22-.5.5.22.5.5.5zM10 7c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 5.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm8 .5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0 4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0-8c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm3 8.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zM14 17c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0 3.5c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm-4-12c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0 8.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm4-4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-4c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-1">
      <circle cx="12" cy="12" r="10"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-2">
      <path d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-3">
      <path d="M9 2c-1.05 0-2.05.16-3 .46 4.06 1.27 7 5.06 7 9.54 0 4.48-2.94 8.27-7 9.54.95.3 1.95.46 3 .46 5.52 0 10-4.48 10-10S14.52 2 9 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-4">
      <path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-.89 0-1.74-.2-2.5-.55C11.56 16.5 13 14.42 13 12s-1.44-4.5-3.5-5.45C10.26 6.2 11.11 6 12 6c3.31 0 6 2.69 6 6s-2.69 6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-5">
      <path d="M20 15.31L23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-6">
      <path d="M20 15.31L23.31 12 20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18V6c3.31 0 6 2.69 6 6s-2.69 6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brightness-7">
      <path d="M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12 20 8.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="broken-image">
      <path d="M21 5v6.59l-3-3.01-4 4.01-4-4-4 4-3-3.01V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2zm-3 6.42l3 3.01V19c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-6.58l3 2.99 4-4 4 4 4-3.99z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="brush">
      <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2a4 4 0 0 0 4-4c0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34a.996.996 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a.996.996 0 0 0 0-1.41z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="burst-mode">
      <path d="M1 5h2v14H1zm4 0h2v14H5zm17 0H10c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1zM11 17l2.5-3.15L15.29 16l2.5-3.22L21 17H11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="camera">
      <path d="M9.4 10.5l4.77-8.26a9.984 9.984 0 0 0-8.49 2.01l3.66 6.35.06-.1zM21.54 9c-.92-2.92-3.15-5.26-6-6.34L11.88 9h9.66zm.26 1h-7.49l.29.5 4.76 8.25A9.91 9.91 0 0 0 22 12c0-.69-.07-1.35-.2-2zM8.54 12l-3.9-6.75A9.958 9.958 0 0 0 2.2 14h7.49l-1.15-2zm-6.08 3c.92 2.92 3.15 5.26 6 6.34L12.12 15H2.46zm11.27 0l-3.9 6.76a9.984 9.984 0 0 0 8.49-2.01l-3.66-6.35-.93 1.6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="camera-alt">
      <circle cx="12" cy="12" r="3.2"/>
      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="camera-front">
      <path d="M10 20H5v2h5v2l3-3-3-3v2zm4 0v2h5v-2h-5zM12 8c1.1 0 2-.9 2-2s-.9-2-2-2-1.99.9-1.99 2S10.9 8 12 8zm5-8H7C5.9 0 5 .9 5 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zM7 2h10v10.5c0-1.67-3.33-2.5-5-2.5s-5 .83-5 2.5V2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="camera-rear">
      <path d="M10 20H5v2h5v2l3-3-3-3v2zm4 0v2h5v-2h-5zm3-20H7C5.9 0 5 .9 5 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V2c0-1.1-.9-2-2-2zm-5 6c-1.11 0-2-.9-2-2s.89-2 1.99-2 2 .9 2 2C14 5.1 13.1 6 12 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="camera-roll">
      <path d="M14 5c0-1.1-.9-2-2-2h-1V2c0-.55-.45-1-1-1H6c-.55 0-1 .45-1 1v1H4c-1.1 0-2 .9-2 2v15c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2h8V5h-8zm-2 13h-2v-2h2v2zm0-9h-2V7h2v2zm4 9h-2v-2h2v2zm0-9h-2V7h2v2zm4 9h-2v-2h2v2zm0-9h-2V7h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="center-focus-strong">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm-7 7H3v4c0 1.1.9 2 2 2h4v-2H5v-4zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2V5zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2zm0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="center-focus-weak">
      <path d="M5 15H3v4c0 1.1.9 2 2 2h4v-2H5v-4zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2V5zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2zm0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zM12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="collections">
      <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="collections-bookmark">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 10l-2.5-1.5L15 12V4h5v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="color-lens">
      <path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="colorize">
      <path d="M20.71 5.63l-2.34-2.34a.996.996 0 0 0-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12a1 1 0 0 0 .01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="compare">
      <path d="M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm9-15h-5v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="control-point">
      <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="control-point-duplicate">
      <path d="M16 8h-2v3h-3v2h3v3h2v-3h3v-2h-3zM2 12c0-2.79 1.64-5.2 4.01-6.32V3.52C2.52 4.76 0 8.09 0 12s2.52 7.24 6.01 8.48v-2.16A6.99 6.99 0 0 1 2 12zm13-9c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-16-9">
      <path d="M19 6H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H5V8h14v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop">
      <path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-3-2">
      <path d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V6h14v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-5-4">
      <path d="M19 5H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H5V7h14v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-7-5">
      <path d="M19 7H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 8H5V9h14v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-din">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-free">
      <path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-landscape">
      <path d="M19 5H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H5V7h14v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-original">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-portrait">
      <path d="M17 3H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7V5h10v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-rotate">
      <path d="M7.47 21.49C4.2 19.93 1.86 16.76 1.5 13H0c.51 6.16 5.66 11 11.95 11 .23 0 .44-.02.66-.03L8.8 20.15l-1.33 1.34zM12.05 0c-.23 0-.44.02-.66.04l3.81 3.81 1.33-1.33C19.8 4.07 22.14 7.24 22.5 11H24c-.51-6.16-5.66-11-11.95-11zM16 14h2V8a2 2 0 0 0-2-2h-6v2h6v6zm-8 2V4H6v2H4v2h2v8a2 2 0 0 0 2 2h8v2h2v-2h2v-2H8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="crop-square">
      <path d="M18 4H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H6V6h12v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="dehaze">
      <path d="M2 15.5v2h20v-2H2zm0-5v2h20v-2H2zm0-5v2h20v-2H2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="details">
      <path d="M3 4l9 16 9-16H3zm3.38 2h11.25L12 16 6.38 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="edit">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="exposure">
      <path d="M15 17v2h2v-2h2v-2h-2v-2h-2v2h-2v2h2zm5-15H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM5 5h6v2H5V5zm15 15H4L20 4v16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="exposure-neg-1">
      <path d="M4 11v2h8v-2H4zm15 7h-2V7.38L14 8.4V6.7L18.7 5h.3v13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="exposure-neg-2">
      <path d="M15.05 16.29l2.86-3.07c.38-.39.72-.79 1.04-1.18.32-.39.59-.78.82-1.17.23-.39.41-.78.54-1.17s.19-.79.19-1.18c0-.53-.09-1.02-.27-1.46a2.94 2.94 0 0 0-.78-1.11c-.34-.31-.77-.54-1.26-.71A5.72 5.72 0 0 0 16.47 5c-.69 0-1.31.11-1.85.32-.54.21-1 .51-1.36.88-.37.37-.65.8-.84 1.3-.18.47-.27.97-.28 1.5h2.14c.01-.31.05-.6.13-.87.09-.29.23-.54.4-.75.18-.21.41-.37.68-.49.27-.12.6-.18.96-.18.31 0 .58.05.81.15.23.1.43.25.59.43.16.18.28.4.37.65.08.25.13.52.13.81 0 .22-.03.43-.08.65-.06.22-.15.45-.29.7-.14.25-.32.53-.56.83-.23.3-.52.65-.88 1.03l-4.17 4.55V18H21v-1.71h-5.95zM2 11v2h8v-2H2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="exposure-plus-1">
      <path d="M10 7H8v4H4v2h4v4h2v-4h4v-2h-4V7zm10 11h-2V7.38L15 8.4V6.7L19.7 5h.3v13z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="exposure-plus-2">
      <path d="M16.05 16.29l2.86-3.07c.38-.39.72-.79 1.04-1.18.32-.39.59-.78.82-1.17.23-.39.41-.78.54-1.17.13-.39.19-.79.19-1.18 0-.53-.09-1.02-.27-1.46a2.94 2.94 0 0 0-.78-1.11c-.34-.31-.77-.54-1.26-.71A5.72 5.72 0 0 0 17.47 5c-.69 0-1.31.11-1.85.32-.54.21-1 .51-1.36.88-.37.37-.65.8-.84 1.3-.18.47-.27.97-.28 1.5h2.14c.01-.31.05-.6.13-.87.09-.29.23-.54.4-.75.18-.21.41-.37.68-.49.27-.12.6-.18.96-.18.31 0 .58.05.81.15.23.1.43.25.59.43.16.18.28.4.37.65.08.25.13.52.13.81 0 .22-.03.43-.08.65-.06.22-.15.45-.29.7-.14.25-.32.53-.56.83-.23.3-.52.65-.88 1.03l-4.17 4.55V18H22v-1.71h-5.95zM8 7H6v4H2v2h4v4h2v-4h4v-2H8V7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="exposure-zero">
      <path d="M16.14 12.5c0 1-.1 1.85-.3 2.55-.2.7-.48 1.27-.83 1.7-.36.44-.79.75-1.3.95-.51.2-1.07.3-1.7.3-.62 0-1.18-.1-1.69-.3-.51-.2-.95-.51-1.31-.95-.36-.44-.65-1.01-.85-1.7-.2-.7-.3-1.55-.3-2.55v-2.04c0-1 .1-1.85.3-2.55.2-.7.48-1.26.84-1.69.36-.43.8-.74 1.31-.93C10.81 5.1 11.38 5 12 5c.63 0 1.19.1 1.7.29.51.19.95.5 1.31.93.36.43.64.99.84 1.69.2.7.3 1.54.3 2.55v2.04zm-2.11-2.36c0-.64-.05-1.18-.13-1.62-.09-.44-.22-.79-.4-1.06-.17-.27-.39-.46-.64-.58-.25-.13-.54-.19-.86-.19-.32 0-.61.06-.86.18s-.47.31-.64.58c-.17.27-.31.62-.4 1.06s-.13.98-.13 1.62v2.67c0 .64.05 1.18.14 1.62.09.45.23.81.4 1.09s.39.48.64.61.54.19.87.19c.33 0 .62-.06.87-.19s.46-.33.63-.61c.17-.28.3-.64.39-1.09.09-.45.13-.99.13-1.62v-2.66z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-1">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm11 10h2V5h-4v2h2v8zm7-14H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter">
      <path d="M15.96 10.29l-2.75 3.54-1.96-2.36L8.5 15h11l-3.54-4.71zM3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-2">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14zm-4-4h-4v-2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4v2h4v2h-2a2 2 0 0 0-2 2v4h6v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-3">
      <path d="M21 1H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14zM3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm14 8v-1.5c0-.83-.67-1.5-1.5-1.5.83 0 1.5-.67 1.5-1.5V7a2 2 0 0 0-2-2h-4v2h4v2h-2v2h2v2h-4v2h4a2 2 0 0 0 2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-4">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm12 10h2V5h-2v4h-2V5h-2v6h4v4zm6-14H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-5">
      <path d="M21 1H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14zM3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm14 8v-2a2 2 0 0 0-2-2h-2V7h4V5h-6v6h4v2h-4v2h4a2 2 0 0 0 2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-6">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14zm-8-2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2V7h4V5h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm0-4h2v2h-2v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-7">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14zm-8-2l4-8V5h-6v2h4l-4 8h2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-8">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14zm-8-2h2a2 2 0 0 0 2-2v-1.5c0-.83-.67-1.5-1.5-1.5.83 0 1.5-.67 1.5-1.5V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v1.5c0 .83.67 1.5 1.5 1.5-.83 0-1.5.67-1.5 1.5V13a2 2 0 0 0 2 2zm0-8h2v2h-2V7zm0 4h2v2h-2v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-9">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14zM15 5h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2v2h-4v2h4a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 4h-2V7h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-9-plus">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm11 7V8a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v1H9v2h3a2 2 0 0 0 2-2zm-3-3V8h1v1h-1zm10-8H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 8h-2V7h-2v2h-2v2h2v2h2v-2h2v6H7V3h14v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-b-and-w">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16l-7-8v8H5l7-8V5h7v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-center-focus">
      <path d="M5 15H3v4c0 1.1.9 2 2 2h4v-2H5v-4zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2V5zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2zm0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-drama">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.64 4.04A5.996 5.996 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4h2c0-2.76-1.86-5.08-4.4-5.78C8.61 6.88 10.2 6 12 6c3.03 0 5.5 2.47 5.5 5.5v.5H19c1.65 0 3 1.35 3 3s-1.35 3-3 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-frames">
      <path d="M20 4h-4l-4-4-4 4H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H4V6h4.52l3.52-3.5L15.52 6H20v14zM18 8H6v10h12"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-hdr">
      <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-none">
      <path d="M3 5H1v16c0 1.1.9 2 2 2h16v-2H3V5zm18-4H7c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 16H7V3h14v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-tilt-shift">
      <path d="M11 4.07V2.05c-2.01.2-3.84 1-5.32 2.21L7.1 5.69A7.94 7.94 0 0 1 11 4.07zm7.32.19A9.95 9.95 0 0 0 13 2.05v2.02c1.46.18 2.79.76 3.9 1.62l1.42-1.43zM19.93 11h2.02c-.2-2.01-1-3.84-2.21-5.32L18.31 7.1a7.94 7.94 0 0 1 1.62 3.9zM5.69 7.1L4.26 5.68A9.95 9.95 0 0 0 2.05 11h2.02a7.94 7.94 0 0 1 1.62-3.9zM4.07 13H2.05c.2 2.01 1 3.84 2.21 5.32l1.43-1.43A7.868 7.868 0 0 1 4.07 13zM15 12c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3zm3.31 4.9l1.43 1.43a9.98 9.98 0 0 0 2.21-5.32h-2.02a7.945 7.945 0 0 1-1.62 3.89zM13 19.93v2.02c2.01-.2 3.84-1 5.32-2.21l-1.43-1.43c-1.1.86-2.43 1.44-3.89 1.62zm-7.32-.19A9.98 9.98 0 0 0 11 21.95v-2.02a7.94 7.94 0 0 1-3.9-1.62l-1.42 1.43z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="filter-vintage">
      <path d="M18.7 12.4a6.06 6.06 0 0 0-.86-.4c.29-.11.58-.24.86-.4a6.012 6.012 0 0 0 3-5.19 6.007 6.007 0 0 0-6 0c-.28.16-.54.35-.78.54.05-.31.08-.63.08-.95 0-2.22-1.21-4.15-3-5.19C10.21 1.85 9 3.78 9 6c0 .32.03.64.08.95-.24-.2-.5-.39-.78-.55a6.008 6.008 0 0 0-6 0 5.97 5.97 0 0 0 3 5.19c.28.16.57.29.86.4-.29.11-.58.24-.86.4a6.012 6.012 0 0 0-3 5.19 6.007 6.007 0 0 0 6 0c.28-.16.54-.35.78-.54-.05.32-.08.64-.08.96 0 2.22 1.21 4.15 3 5.19 1.79-1.04 3-2.97 3-5.19 0-.32-.03-.64-.08-.95.24.2.5.38.78.54a6.008 6.008 0 0 0 6 0 6.012 6.012 0 0 0-3-5.19zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flare">
      <path d="M7 11H1v2h6v-2zm2.17-3.24L7.05 5.64 5.64 7.05l2.12 2.12 1.41-1.41zM13 1h-2v6h2V1zm5.36 6.05l-1.41-1.41-2.12 2.12 1.41 1.41 2.12-2.12zM17 11v2h6v-2h-6zm-5-2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm2.83 7.24l2.12 2.12 1.41-1.41-2.12-2.12-1.41 1.41zm-9.19.71l1.41 1.41 2.12-2.12-1.41-1.41-2.12 2.12zM11 23h2v-6h-2v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flash-auto">
      <path d="M3 2v12h3v9l7-12H9l4-9H3zm16 0h-2l-3.2 9h1.9l.7-2h3.2l.7 2h1.9L19 2zm-2.15 5.65L18 4l1.15 3.65h-2.3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flash-off">
      <path d="M3.27 3L2 4.27l5 5V13h3v9l3.58-6.14L17.73 20 19 18.73 3.27 3zM17 10h-4l4-8H7v2.18l8.46 8.46L17 10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flash-on">
      <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flip">
      <path d="M15 21h2v-2h-2v2zm4-12h2V7h-2v2zM3 5v14c0 1.1.9 2 2 2h4v-2H5V5h4V3H5c-1.1 0-2 .9-2 2zm16-2v2h2c0-1.1-.9-2-2-2zm-8 20h2V1h-2v22zm8-6h2v-2h-2v2zM15 5h2V3h-2v2zm4 8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="gradient">
      <path d="M11 9h2v2h-2zm-2 2h2v2H9zm4 0h2v2h-2zm2-2h2v2h-2zM7 9h2v2H7zm12-6H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 18H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm2-7h-2v2h2v2h-2v-2h-2v2h-2v-2h-2v2H9v-2H7v2H5v-2h2v-2H5V5h14v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="grain">
      <path d="M10 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM6 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-4 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm4-4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-4-4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-4-4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="grid-off">
      <path d="M8 4v1.45l2 2V4h4v4h-3.45l2 2H14v1.45l2 2V10h4v4h-3.45l2 2H20v1.45l2 2V4c0-1.1-.9-2-2-2H4.55l2 2H8zm8 0h4v4h-4V4zM1.27 1.27L0 2.55l2 2V20c0 1.1.9 2 2 2h15.46l2 2 1.27-1.27L1.27 1.27zM10 12.55L11.45 14H10v-1.45zm-6-6L5.45 8H4V6.55zM8 20H4v-4h4v4zm0-6H4v-4h3.45l.55.55V14zm6 6h-4v-4h3.45l.55.54V20zm2 0v-1.46L17.46 20H16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="grid-on">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hdr-off">
      <path d="M17.5 15v-2h1.1l.9 2H21l-.9-2.1c.5-.2.9-.8.9-1.4v-1c0-.8-.7-1.5-1.5-1.5H16v4.9l1.1 1.1h.4zm0-4.5h2v1h-2v-1zm-4.5 0v.4l1.5 1.5v-1.9c0-.8-.7-1.5-1.5-1.5h-1.9l1.5 1.5h.4zm-3.5-1l-7-7-1.1 1L6.9 9h-.4v2h-2V9H3v6h1.5v-2.5h2V15H8v-4.9l1.5 1.5V15h3.4l7.6 7.6 1.1-1.1-12.1-12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hdr-on">
      <path d="M21 11.5v-1c0-.8-.7-1.5-1.5-1.5H16v6h1.5v-2h1.1l.9 2H21l-.9-2.1c.5-.3.9-.8.9-1.4zm-1.5 0h-2v-1h2v1zm-13-.5h-2V9H3v6h1.5v-2.5h2V15H8V9H6.5v2zM13 9H9.5v6H13c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5zm0 4.5h-2v-3h2v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hdr-strong">
      <path d="M17 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zM5 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hdr-weak">
      <path d="M5 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm12-2c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="healing">
      <path d="M17.73 12.02l3.98-3.98a.996.996 0 0 0 0-1.41l-4.34-4.34a.996.996 0 0 0-1.41 0l-3.98 3.98L8 2.29a1 1 0 0 0-1.41 0L2.25 6.63a.996.996 0 0 0 0 1.41l3.98 3.98L2.25 16a.996.996 0 0 0 0 1.41l4.34 4.34c.39.39 1.02.39 1.41 0l3.98-3.98 3.98 3.98c.2.2.45.29.71.29.26 0 .51-.1.71-.29l4.34-4.34a.996.996 0 0 0 0-1.41l-3.99-3.98zM12 9c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-4.71 1.96L3.66 7.34l3.63-3.63 3.62 3.62-3.62 3.63zM10 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 2c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2-4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2.66 9.34l-3.63-3.62 3.63-3.63 3.62 3.62-3.62 3.63z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="image">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="image-aspect-ratio">
      <path d="M16 10h-2v2h2v-2zm0 4h-2v2h2v-2zm-8-4H6v2h2v-2zm4 0h-2v2h2v-2zm8-6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="iso">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5.5 7.5h2v-2H9v2h2V9H9v2H7.5V9h-2V7.5zM19 19H5L19 5v14zm-2-2v-1.5h-5V17h5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="landscape">
      <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="leak-add">
      <path d="M6 3H3v3c1.66 0 3-1.34 3-3zm8 0h-2a9 9 0 0 1-9 9v2c6.08 0 11-4.93 11-11zm-4 0H8c0 2.76-2.24 5-5 5v2c3.87 0 7-3.13 7-7zm0 18h2a9 9 0 0 1 9-9v-2c-6.07 0-11 4.93-11 11zm8 0h3v-3c-1.66 0-3 1.34-3 3zm-4 0h2c0-2.76 2.24-5 5-5v-2c-3.87 0-7 3.13-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="leak-remove">
      <path d="M10 3H8c0 .37-.04.72-.12 1.06l1.59 1.59C9.81 4.84 10 3.94 10 3zM3 4.27l2.84 2.84C5.03 7.67 4.06 8 3 8v2c1.61 0 3.09-.55 4.27-1.46L8.7 9.97A8.99 8.99 0 0 1 3 12v2c2.71 0 5.19-.99 7.11-2.62l2.5 2.5A11.044 11.044 0 0 0 10 21h2c0-2.16.76-4.14 2.03-5.69l1.43 1.43A6.922 6.922 0 0 0 14 21h2c0-1.06.33-2.03.89-2.84L19.73 21 21 19.73 4.27 3 3 4.27zM14 3h-2c0 1.5-.37 2.91-1.02 4.16l1.46 1.46C13.42 6.98 14 5.06 14 3zm5.94 13.12c.34-.08.69-.12 1.06-.12v-2c-.94 0-1.84.19-2.66.52l1.6 1.6zm-4.56-4.56l1.46 1.46A8.98 8.98 0 0 1 21 12v-2c-2.06 0-3.98.58-5.62 1.56z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="lens">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="linked-camera">
      <circle cx="12" cy="14" r="3.2"/>
      <path d="M16 3.33A4.67 4.67 0 0 1 20.67 8H22c0-3.31-2.69-6-6-6v1.33M16 6c1.11 0 2 .89 2 2h1.33A3.33 3.33 0 0 0 16 4.67V6"/>
      <path d="M17 9c0-1.11-.89-2-2-2V4H9L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9h-5zm-5 10c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="looks">
      <path d="M12 10c-3.86 0-7 3.14-7 7h2c0-2.76 2.24-5 5-5s5 2.24 5 5h2c0-3.86-3.14-7-7-7zm0-4C5.93 6 1 10.93 1 17h2c0-4.96 4.04-9 9-9s9 4.04 9 9h2c0-6.07-4.93-11-11-11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="looks-3">
      <path d="M19.01 3h-14c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 7.5c0 .83-.67 1.5-1.5 1.5.83 0 1.5.67 1.5 1.5V15a2 2 0 0 1-2 2h-4v-2h4v-2h-2v-2h2V9h-4V7h4a2 2 0 0 1 2 2v1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="looks-4">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 14h-2v-4H9V7h2v4h2V7h2v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="looks-5">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H9v-2h4v-2H9V7h6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="looks-6">
      <path d="M11 15h2v-2h-2v2zm8-12H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 6h-4v2h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="looks-one">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2V9h-2V7h4v10z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="looks-two">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-4 8a2 2 0 0 1-2 2h-2v2h4v2H9v-4a2 2 0 0 1 2-2h2V9H9V7h4a2 2 0 0 1 2 2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="loupe">
      <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.49 2 2 6.49 2 12s4.49 10 10 10h8c1.1 0 2-.9 2-2v-8c0-5.51-4.49-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="monochrome-photos">
      <path d="M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 14h-8v-1c-2.8 0-5-2.2-5-5s2.2-5 5-5V7h8v12zm-3-6c0-2.8-2.2-5-5-5v1.8c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.2-3.2 3.2V18c2.8 0 5-2.2 5-5zm-8.2 0c0 1.8 1.4 3.2 3.2 3.2V9.8c-1.8 0-3.2 1.4-3.2 3.2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="movie-creation">
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="movie-filter">
      <path d="M18 4l2 3h-3l-2-3h-2l2 3h-3l-2-3H8l2 3H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4zm-6.75 11.25L10 18l-1.25-2.75L6 14l2.75-1.25L10 10l1.25 2.75L14 14l-2.75 1.25zm5.69-3.31L16 14l-.94-2.06L13 11l2.06-.94L16 8l.94 2.06L19 11l-2.06.94z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="music-note">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="nature">
      <path d="M13 16.12a7 7 0 0 0 6.17-6.95c0-3.87-3.13-7-7-7s-7 3.13-7 7A6.98 6.98 0 0 0 11 16.06V20H5v2h14v-2h-6v-3.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="nature-people">
      <path d="M22.17 9.17c0-3.87-3.13-7-7-7s-7 3.13-7 7A6.98 6.98 0 0 0 14 16.06V20H6v-3h1v-4c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v4h1v5h16v-2h-3v-3.88a7 7 0 0 0 6.17-6.95zM4.5 11c.83 0 1.5-.67 1.5-1.5S5.33 8 4.5 8 3 8.67 3 9.5 3.67 11 4.5 11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="navigate-before">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="navigate-next">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="palette">
      <path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="panorama">
      <path d="M23 18V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zM8.5 12.5l2.5 3.01L14.5 11l4.5 6H5l3.5-4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="panorama-fish-eye">
      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="panorama-horizontal">
      <path d="M20 6.54v10.91c-2.6-.77-5.28-1.16-8-1.16-2.72 0-5.4.39-8 1.16V6.54c2.6.77 5.28 1.16 8 1.16 2.72.01 5.4-.38 8-1.16M21.43 4c-.1 0-.2.02-.31.06C18.18 5.16 15.09 5.7 12 5.7c-3.09 0-6.18-.55-9.12-1.64A.94.94 0 0 0 2.57 4c-.34 0-.57.23-.57.63v14.75c0 .39.23.62.57.62.1 0 .2-.02.31-.06 2.94-1.1 6.03-1.64 9.12-1.64 3.09 0 6.18.55 9.12 1.64.11.04.21.06.31.06.33 0 .57-.23.57-.63V4.63c0-.4-.24-.63-.57-.63z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="panorama-vertical">
      <path d="M19.94 21.12c-1.1-2.94-1.64-6.03-1.64-9.12 0-3.09.55-6.18 1.64-9.12a.94.94 0 0 0 .06-.31c0-.34-.23-.57-.63-.57H4.63c-.4 0-.63.23-.63.57 0 .1.02.2.06.31C5.16 5.82 5.71 8.91 5.71 12c0 3.09-.55 6.18-1.64 9.12-.05.11-.07.22-.07.31 0 .33.23.57.63.57h14.75c.39 0 .63-.24.63-.57-.01-.1-.03-.2-.07-.31zM6.54 20c.77-2.6 1.16-5.28 1.16-8 0-2.72-.39-5.4-1.16-8h10.91c-.77 2.6-1.16 5.28-1.16 8 0 2.72.39 5.4 1.16 8H6.54z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="panorama-wide-angle">
      <path d="M12 6c2.45 0 4.71.2 7.29.64A21 21 0 0 1 20 12a21 21 0 0 1-.71 5.36c-2.58.44-4.84.64-7.29.64s-4.71-.2-7.29-.64A21 21 0 0 1 4 12a21 21 0 0 1 .71-5.36C7.29 6.2 9.55 6 12 6m0-2c-2.73 0-5.22.24-7.95.72l-.93.16-.25.9C2.29 7.85 2 9.93 2 12s.29 4.15.87 6.22l.25.89.93.16c2.73.49 5.22.73 7.95.73s5.22-.24 7.95-.72l.93-.16.25-.89c.58-2.08.87-4.16.87-6.23s-.29-4.15-.87-6.22l-.25-.89-.93-.16C17.22 4.24 14.73 4 12 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo-album">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4zm0 15l3-3.86 2.14 2.58 3-3.86L18 19H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo-camera">
      <circle cx="12" cy="12" r="3.2"/>
      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo-filter">
      <path d="M19.02 10v9H5V5h9V3H5.02c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-9h-2zM17 10l.94-2.06L20 7l-2.06-.94L17 4l-.94 2.06L14 7l2.06.94zm-3.75.75L12 8l-1.25 2.75L8 12l2.75 1.25L12 16l1.25-2.75L16 12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo-library">
      <path d="M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo-size-select-actual">
      <path d="M21 3H3C2 3 1 4 1 5v14c0 1.1.9 2 2 2h18c1 0 2-1 2-2V5c0-1-1-2-2-2zM5 17l3.5-4.5 2.5 3.01L14.5 11l4.5 6H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo-size-select-large">
      <path d="M21 15h2v2h-2v-2zm0-4h2v2h-2v-2zm2 8h-2v2c1 0 2-1 2-2zM13 3h2v2h-2V3zm8 4h2v2h-2V7zm0-4v2h2c0-1-1-2-2-2zM1 7h2v2H1V7zm16-4h2v2h-2V3zm0 16h2v2h-2v-2zM3 3C2 3 1 4 1 5h2V3zm6 0h2v2H9V3zM5 3h2v2H5V3zm-4 8v8c0 1.1.9 2 2 2h12V11H1zm2 8l2.5-3.21 1.79 2.15 2.5-3.22L13 19H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="photo-size-select-small">
      <path d="M23 15h-2v2h2v-2zm0-4h-2v2h2v-2zm0 8h-2v2c1 0 2-1 2-2zM15 3h-2v2h2V3zm8 4h-2v2h2V7zm-2-4v2h2c0-1-1-2-2-2zM3 21h8v-6H1v4c0 1.1.9 2 2 2zM3 7H1v2h2V7zm12 12h-2v2h2v-2zm4-16h-2v2h2V3zm0 16h-2v2h2v-2zM3 3C2 3 1 4 1 5h2V3zm0 8H1v2h2v-2zm8-8H9v2h2V3zM7 3H5v2h2V3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="picture-as-pdf">
      <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="portrait">
      <path d="M12 12.25c1.24 0 2.25-1.01 2.25-2.25S13.24 7.75 12 7.75 9.75 8.76 9.75 10s1.01 2.25 2.25 2.25zm4.5 4c0-1.5-3-2.25-4.5-2.25s-4.5.75-4.5 2.25V17h9v-.75zM19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="remove-red-eye">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rotate-90-degrees-ccw">
      <path d="M7.34 6.41L.86 12.9l6.49 6.48 6.49-6.48-6.5-6.49zM3.69 12.9l3.66-3.66L11 12.9l-3.66 3.66-3.65-3.66zm15.67-6.26A8.95 8.95 0 0 0 13 4V.76L8.76 5 13 9.24V6c1.79 0 3.58.68 4.95 2.05a7.007 7.007 0 0 1 0 9.9 6.973 6.973 0 0 1-7.79 1.44l-1.49 1.49C10.02 21.62 11.51 22 13 22c2.3 0 4.61-.88 6.36-2.64a8.98 8.98 0 0 0 0-12.72z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rotate-left">
      <path d="M7.11 8.53L5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rotate-right">
      <path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11a7.906 7.906 0 0 0-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="slideshow">
      <path d="M10 8v8l5-4-5-4zm9-5H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="straighten">
      <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="style">
      <path d="M2.53 19.65l1.34.56v-9.03l-2.43 5.86a2.02 2.02 0 0 0 1.09 2.61zm19.5-3.7L17.07 3.98a2.013 2.013 0 0 0-1.81-1.23c-.26 0-.53.04-.79.15L7.1 5.95a2 2 0 0 0-1.08 2.6l4.96 11.97a1.998 1.998 0 0 0 2.6 1.08l7.36-3.05a1.994 1.994 0 0 0 1.09-2.6zM7.88 8.75c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2 11c0 1.1.9 2 2 2h1.45l-3.45-8.34v6.34z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="switch-camera">
      <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11.5V13H9v2.5L5.5 12 9 8.5V11h6V8.5l3.5 3.5-3.5 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="switch-video">
      <path d="M18 9.5V6c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h14c.55 0 1-.45 1-1v-3.5l4 4v-13l-4 4zm-5 6V13H7v2.5L3.5 12 7 8.5V11h6V8.5l3.5 3.5-3.5 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tag-faces">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="texture">
      <path d="M19.51 3.08L3.08 19.51c.09.34.27.65.51.9.25.24.56.42.9.51L20.93 4.49c-.19-.69-.73-1.23-1.42-1.41zM11.88 3L3 11.88v2.83L14.71 3h-2.83zM5 3c-1.1 0-2 .9-2 2v2l4-4H5zm14 18c.55 0 1.05-.22 1.41-.59.37-.36.59-.86.59-1.41v-2l-4 4h2zm-9.71 0h2.83L21 12.12V9.29L9.29 21z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="timelapse">
      <path d="M16.24 7.76A5.974 5.974 0 0 0 12 6v6l-4.24 4.24c2.34 2.34 6.14 2.34 8.49 0a5.99 5.99 0 0 0-.01-8.48zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="timer-10">
      <path d="M0 7.72V9.4l3-1V18h2V6h-.25L0 7.72zm23.78 6.65c-.14-.28-.35-.53-.63-.74-.28-.21-.61-.39-1.01-.53s-.85-.27-1.35-.38a6.64 6.64 0 0 1-.87-.23 2.61 2.61 0 0 1-.55-.25.717.717 0 0 1-.28-.3.978.978 0 0 1 .01-.8c.06-.13.15-.25.27-.34.12-.1.27-.18.45-.24s.4-.09.64-.09c.25 0 .47.04.66.11.19.07.35.17.48.29.13.12.22.26.29.42.06.16.1.32.1.49h1.95a2.517 2.517 0 0 0-.93-1.97c-.3-.25-.66-.44-1.09-.59C21.49 9.07 21 9 20.46 9c-.51 0-.98.07-1.39.21-.41.14-.77.33-1.06.57-.29.24-.51.52-.67.84-.16.32-.23.65-.23 1.01s.08.69.23.96c.15.28.36.52.64.73.27.21.6.38.98.53.38.14.81.26 1.27.36.39.08.71.17.95.26s.43.19.57.29c.13.1.22.22.27.34.05.12.07.25.07.39 0 .32-.13.57-.4.77-.27.2-.66.29-1.17.29-.22 0-.43-.02-.64-.08-.21-.05-.4-.13-.56-.24a1.333 1.333 0 0 1-.59-1.11h-1.89c0 .36.08.71.24 1.05.16.34.39.65.7.93.31.27.69.49 1.15.66.46.17.98.25 1.58.25.53 0 1.01-.06 1.44-.19.43-.13.8-.31 1.11-.54.31-.23.54-.51.71-.83.17-.32.25-.67.25-1.06-.02-.4-.09-.74-.24-1.02zm-9.96-7.32c-.34-.4-.75-.7-1.23-.88-.47-.18-1.01-.27-1.59-.27-.58 0-1.11.09-1.59.27-.48.18-.89.47-1.23.88-.34.41-.6.93-.79 1.59-.18.65-.28 1.45-.28 2.39v1.92c0 .94.09 1.74.28 2.39.19.66.45 1.19.8 1.6.34.41.75.71 1.23.89.48.18 1.01.28 1.59.28.59 0 1.12-.09 1.59-.28.48-.18.88-.48 1.22-.89.34-.41.6-.94.78-1.6.18-.65.28-1.45.28-2.39v-1.92c0-.94-.09-1.74-.28-2.39-.18-.66-.44-1.19-.78-1.59zm-.92 6.17c0 .6-.04 1.11-.12 1.53-.08.42-.2.76-.36 1.02-.16.26-.36.45-.59.57-.23.12-.51.18-.82.18-.3 0-.58-.06-.82-.18s-.44-.31-.6-.57c-.16-.26-.29-.6-.38-1.02-.09-.42-.13-.93-.13-1.53v-2.5c0-.6.04-1.11.13-1.52.09-.41.21-.74.38-1 .16-.25.36-.43.6-.55.24-.11.51-.17.81-.17.31 0 .58.06.81.17.24.11.44.29.6.55.16.25.29.58.37.99.08.41.13.92.13 1.52v2.51z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="timer">
      <path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0 0 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9a8.994 8.994 0 0 0 7.03-14.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="timer-3">
      <path d="M11.61 12.97c-.16-.24-.36-.46-.62-.65a3.38 3.38 0 0 0-.93-.48c.3-.14.57-.3.8-.5.23-.2.42-.41.57-.64.15-.23.27-.46.34-.71.08-.24.11-.49.11-.73 0-.55-.09-1.04-.28-1.46-.18-.42-.44-.77-.78-1.06-.33-.28-.73-.5-1.2-.64-.45-.13-.97-.2-1.53-.2-.55 0-1.06.08-1.52.24-.47.17-.87.4-1.2.69-.33.29-.6.63-.78 1.03-.2.39-.29.83-.29 1.29h1.98c0-.26.05-.49.14-.69.09-.2.22-.38.38-.52.17-.14.36-.25.58-.33.22-.08.46-.12.73-.12.61 0 1.06.16 1.36.47.3.31.44.75.44 1.32 0 .27-.04.52-.12.74-.08.22-.21.41-.38.57-.17.16-.38.28-.63.37-.25.09-.55.13-.89.13H6.72v1.57H7.9c.34 0 .64.04.91.11.27.08.5.19.69.35.19.16.34.36.44.61.1.24.16.54.16.87 0 .62-.18 1.09-.53 1.42-.35.33-.84.49-1.45.49-.29 0-.56-.04-.8-.13-.24-.08-.44-.2-.61-.36-.17-.16-.3-.34-.39-.56-.09-.22-.14-.46-.14-.72H4.19c0 .55.11 1.03.32 1.45.21.42.5.77.86 1.05s.77.49 1.24.63.96.21 1.48.21c.57 0 1.09-.08 1.58-.23.49-.15.91-.38 1.26-.68.36-.3.64-.66.84-1.1.2-.43.3-.93.3-1.48 0-.29-.04-.58-.11-.86-.08-.25-.19-.51-.35-.76zm9.26 1.4c-.14-.28-.35-.53-.63-.74-.28-.21-.61-.39-1.01-.53s-.85-.27-1.35-.38a6.64 6.64 0 0 1-.87-.23 2.61 2.61 0 0 1-.55-.25.717.717 0 0 1-.28-.3c-.05-.11-.08-.24-.08-.39a.946.946 0 0 1 .36-.75c.12-.1.27-.18.45-.24s.4-.09.64-.09c.25 0 .47.04.66.11.19.07.35.17.48.29.13.12.22.26.29.42.06.16.1.32.1.49h1.95a2.517 2.517 0 0 0-.93-1.97c-.3-.25-.66-.44-1.09-.59-.43-.15-.92-.22-1.46-.22-.51 0-.98.07-1.39.21-.41.14-.77.33-1.06.57-.29.24-.51.52-.67.84-.16.32-.23.65-.23 1.01s.08.68.23.96c.15.28.37.52.64.73.27.21.6.38.98.53.38.14.81.26 1.27.36.39.08.71.17.95.26s.43.19.57.29c.13.1.22.22.27.34.05.12.07.25.07.39 0 .32-.13.57-.4.77-.27.2-.66.29-1.17.29-.22 0-.43-.02-.64-.08-.21-.05-.4-.13-.56-.24a1.333 1.333 0 0 1-.59-1.11h-1.89c0 .36.08.71.24 1.05.16.34.39.65.7.93.31.27.69.49 1.15.66.46.17.98.25 1.58.25.53 0 1.01-.06 1.44-.19.43-.13.8-.31 1.11-.54.31-.23.54-.51.71-.83.17-.32.25-.67.25-1.06-.02-.4-.09-.74-.24-1.02z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="timer-off">
      <path d="M19.04 4.55l-1.42 1.42a9.012 9.012 0 0 0-10.57-.49l1.46 1.46C9.53 6.35 10.73 6 12 6c3.87 0 7 3.13 7 7 0 1.27-.35 2.47-.94 3.49l1.45 1.45A8.878 8.878 0 0 0 21 13c0-2.12-.74-4.07-1.97-5.61l1.42-1.42-1.41-1.42zM15 1H9v2h6V1zm-4 8.44l2 2V8h-2v1.44zM3.02 4L1.75 5.27 4.5 8.03A8.905 8.905 0 0 0 3 13c0 4.97 4.02 9 9 9 1.84 0 3.55-.55 4.98-1.5l2.5 2.5 1.27-1.27-7.71-7.71L3.02 4zM12 20c-3.87 0-7-3.13-7-7 0-1.28.35-2.48.95-3.52l9.56 9.56c-1.03.61-2.23.96-3.51.96z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tonality">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.05-7.44 7-7.93v15.86zm2-15.86c1.03.13 2 .45 2.87.93H13v-.93zM13 7h5.24c.25.31.48.65.68 1H13V7zm0 3h6.74c.08.33.15.66.19 1H13v-1zm0 9.93V19h2.87c-.87.48-1.84.8-2.87.93zM18.24 17H13v-1h5.92c-.2.35-.43.69-.68 1zm1.5-3H13v-1h6.93c-.04.34-.11.67-.19 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="transform">
      <path d="M22 18v-2H8V4h2L7 1 4 4h2v2H2v2h4v8c0 1.1.9 2 2 2h8v2h-2l3 3 3-3h-2v-2h4zM10 8h6v6h2V8c0-1.1-.9-2-2-2h-6v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tune">
      <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-comfy">
      <path d="M3 9h4V5H3v4zm0 5h4v-4H3v4zm5 0h4v-4H8v4zm5 0h4v-4h-4v4zM8 9h4V5H8v4zm5-4v4h4V5h-4zm5 9h4v-4h-4v4zM3 19h4v-4H3v4zm5 0h4v-4H8v4zm5 0h4v-4h-4v4zm5 0h4v-4h-4v4zm0-14v4h4V5h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="view-compact">
      <path d="M3 19h6v-7H3v7zm7 0h12v-7H10v7zM3 5v6h19V5H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="vignette">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 15c-4.42 0-8-2.69-8-6s3.58-6 8-6 8 2.69 8 6-3.58 6-8 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wb-auto">
      <path d="M6.85 12.65h2.3L8 9l-1.15 3.65zM22 7l-1.2 6.29L19.3 7h-1.6l-1.49 6.29L15 7h-.76A7.97 7.97 0 0 0 8 4c-4.42 0-8 3.58-8 8s3.58 8 8 8c3.13 0 5.84-1.81 7.15-4.43l.1.43H17l1.5-6.1L20 16h1.75l2.05-9H22zm-11.7 9l-.7-2H6.4l-.7 2H3.8L7 7h2l3.2 9h-1.9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wb-cloudy">
      <path d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wb-incandescent">
      <path d="M3.55 18.54l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8zM11 22.45h2V19.5h-2v2.95zM4 10.5H1v2h3v-2zm11-4.19V1.5H9v4.81C7.21 7.35 6 9.28 6 11.5c0 3.31 2.69 6 6 6s6-2.69 6-6c0-2.22-1.21-4.15-3-5.19zm5 4.19v2h3v-2h-3zm-2.76 7.66l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wb-iridescent">
      <path d="M5 14.5h14v-6H5v6zM11 .55V3.5h2V.55h-2zm8.04 2.5l-1.79 1.79 1.41 1.41 1.8-1.79-1.42-1.41zM13 22.45V19.5h-2v2.95h2zm7.45-3.91l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zM3.55 4.46l1.79 1.79 1.41-1.41-1.79-1.79-1.41 1.41zm1.41 15.49l1.79-1.8-1.41-1.41-1.79 1.79 1.41 1.42z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wb-sunny">
      <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/>
    </symbol>
  </g>
  <g data-category="maps">
    <symbol viewBox="0 0 24 24" id="add-location">
      <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm4 8h-3v3h-2v-3H8V8h3V5h2v3h3v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="beenhere">
      <path d="M19 1H5c-1.1 0-1.99.9-1.99 2L3 15.93c0 .69.35 1.3.88 1.66L12 23l8.11-5.41c.53-.36.88-.97.88-1.66L21 3c0-1.1-.9-2-2-2zm-9 15l-5-5 1.41-1.41L10 13.17l7.59-7.59L19 7l-9 9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions">
      <path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-bike">
      <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-boat">
      <path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99a8.752 8.752 0 0 0 8 0c1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42a1.007 1.007 0 0 0-.66 1.28L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-bus">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-car">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-railway">
      <path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm8 1.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7H6V5h12v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-run">
      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-subway">
      <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-transit">
      <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="directions-walk">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="edit-location">
      <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm-1.56 10H9v-1.44l3.35-3.34 1.43 1.43L10.44 12zm4.45-4.45l-.7.7-1.44-1.44.7-.7a.38.38 0 0 1 .54 0l.9.9c.15.15.15.39 0 .54z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="ev-station">
      <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33a2.5 2.5 0 0 0 2.5 2.5c.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5a2.5 2.5 0 0 0 5 0V9c0-.69-.28-1.32-.73-1.77zM18 10c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM8 18v-4.5H6L10 6v5h2l-4 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="flight">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hotel">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 0 0-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="layers">
      <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="layers-clear">
      <path d="M19.81 14.99l1.19-.92-1.43-1.43-1.19.92 1.43 1.43zm-.45-4.72L21 9l-9-7-2.91 2.27 7.87 7.88 2.4-1.88zM3.27 1L2 2.27l4.22 4.22L3 9l1.63 1.27L12 16l2.1-1.63 1.43 1.43L12 18.54l-7.37-5.73L3 14.07l9 7 4.95-3.85L20.73 21 22 19.73 3.27 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-activity">
      <path d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2zm-4.42 4.8L12 14.5l-3.58 2.3 1.08-4.12-3.29-2.69 4.24-.25L12 5.8l1.54 3.95 4.24.25-3.29 2.69 1.09 4.11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-airport">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-atm">
      <path d="M11 17h2v-1h1c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1h-3v-1h4V8h-2V7h-2v1h-1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h3v1H9v2h2v1zm9-13H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-bar">
      <path d="M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-cafe">
      <path d="M20 3H4v10a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM2 21h18v-2H2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-car-wash">
      <path d="M17 5c.83 0 1.5-.67 1.5-1.5 0-1-1.5-2.7-1.5-2.7s-1.5 1.7-1.5 2.7c0 .83.67 1.5 1.5 1.5zm-5 0c.83 0 1.5-.67 1.5-1.5 0-1-1.5-2.7-1.5-2.7s-1.5 1.7-1.5 2.7c0 .83.67 1.5 1.5 1.5zM7 5c.83 0 1.5-.67 1.5-1.5C8.5 2.5 7 .8 7 .8S5.5 2.5 5.5 3.5C5.5 4.33 6.17 5 7 5zm11.92 3.01C18.72 7.42 18.16 7 17.5 7h-11c-.66 0-1.21.42-1.42 1.01L3 14v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 18c-.83 0-1.5-.67-1.5-1.5S5.67 15 6.5 15s1.5.67 1.5 1.5S7.33 18 6.5 18zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 13l1.5-4.5h11L19 13H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-convenience-store">
      <path d="M19 7V4H5v3H2v13h8v-4h4v4h8V7h-3zm-8 3H9v1h2v1H8V9h2V8H8V7h3v3zm5 2h-1v-2h-2V7h1v2h1V7h1v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-dining">
      <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-drink">
      <path d="M3 2l2.01 18.23C5.13 21.23 5.97 22 7 22h10c1.03 0 1.87-.77 1.99-1.77L21 2H3zm9 17c-1.66 0-3-1.34-3-3 0-2 3-5.4 3-5.4s3 3.4 3 5.4c0 1.66-1.34 3-3 3zm6.33-11H5.67l-.44-4h13.53l-.43 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-florist">
      <path d="M12 22a9 9 0 0 0 9-9 9 9 0 0 0-9 9zM5.6 10.25a2.5 2.5 0 0 0 3.92 2.06l-.02.19a2.5 2.5 0 0 0 5 0l-.02-.19c.4.28.89.44 1.42.44a2.5 2.5 0 0 0 2.5-2.5c0-1-.59-1.85-1.43-2.25a2.49 2.49 0 0 0 1.43-2.25 2.5 2.5 0 0 0-3.92-2.06l.02-.19a2.5 2.5 0 1 0-5 0l.02.19c-.4-.28-.89-.44-1.42-.44a2.5 2.5 0 0 0-2.5 2.5c0 1 .59 1.85 1.43 2.25a2.49 2.49 0 0 0-1.43 2.25zM12 5.5a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1 0-5zM3 13a9 9 0 0 0 9 9 9 9 0 0 0-9-9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-gas-station">
      <path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33a2.5 2.5 0 0 0 2.5 2.5c.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5a2.5 2.5 0 0 0 5 0V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-grocery-store">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-hospital">
      <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-hotel">
      <path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 0 0-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-laundry-service">
      <path d="M9.17 16.83a4.008 4.008 0 0 0 5.66 0 4.008 4.008 0 0 0 0-5.66l-5.66 5.66zM18 2.01L6 2c-1.11 0-2 .89-2 2v16c0 1.11.89 2 2 2h12c1.11 0 2-.89 2-2V4c0-1.11-.89-1.99-2-1.99zM10 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM7 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm5 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-library">
      <path d="M12 11.55C9.64 9.35 6.48 8 3 8v11c3.48 0 6.64 1.35 9 3.55 2.36-2.19 5.52-3.55 9-3.55V8c-3.48 0-6.64 1.35-9 3.55zM12 8c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-mall">
      <path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-movies">
      <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-offer">
      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-parking">
      <path d="M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-pharmacy">
      <path d="M21 5h-2.64l1.14-3.14L17.15 1l-1.46 4H3v2l2 6-2 6v2h18v-2l-2-6 2-6V5zm-5 9h-3v3h-2v-3H8v-2h3V9h2v3h3v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-phone">
      <path d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-pizza">
      <path d="M12 2C8.43 2 5.23 3.54 3.01 6L12 22l8.99-16C18.78 3.55 15.57 2 12 2zM7 7c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm5 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-play">
      <path d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2zm-4.42 4.8L12 14.5l-3.58 2.3 1.08-4.12-3.29-2.69 4.24-.25L12 5.8l1.54 3.95 4.24.25-3.29 2.69 1.09 4.11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-post-office">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-printshop">
      <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-see">
      <circle cx="12" cy="12" r="3.2"/>
      <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-shipping">
      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="local-taxi">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H9v2H6.5c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="map">
      <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="my-location">
      <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="navigation">
      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="near-me">
      <path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="person-pin">
      <path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 3.3A2.7 2.7 0 0 1 14.7 8a2.7 2.7 0 0 1-2.7 2.7A2.7 2.7 0 0 1 9.3 8 2.7 2.7 0 0 1 12 5.3zM18 16H6v-.9c0-2 4-3.1 6-3.1s6 1.1 6 3.1v.9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="person-pin-circle">
      <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 10c-1.67 0-3.14-.85-4-2.15.02-1.32 2.67-2.05 4-2.05s3.98.73 4 2.05A4.783 4.783 0 0 1 12 14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pin-drop">
      <path d="M18 8c0-3.31-2.69-6-6-6S6 4.69 6 8c0 4.5 6 11 6 11s6-6.5 6-11zm-8 0c0-1.1.9-2 2-2s2 .9 2 2a2 2 0 0 1-4 0zM5 20v2h14v-2H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="place">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rate-review">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 14v-2.47l6.88-6.88c.2-.2.51-.2.71 0l1.77 1.77c.2.2.2.51 0 .71L8.47 14H6zm12 0h-7.5l2-2H18v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="restaurant">
      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="restaurant-menu">
      <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="satellite">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 4.99h3C8 6.65 6.66 8 5 8V4.99zM5 12v-2c2.76 0 5-2.25 5-5.01h2C12 8.86 8.87 12 5 12zm0 6l3.5-4.5 2.5 3.01L14.5 12l4.5 6H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="store-mall-directory">
      <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="streetview">
      <path d="M12.56 14.33c-.34.27-.56.7-.56 1.17V21h7c1.1 0 2-.9 2-2v-5.98c-.94-.33-1.95-.52-3-.52-2.03 0-3.93.7-5.44 1.83z"/>
      <circle cx="18" cy="6" r="5"/>
      <path d="M11.5 6c0-1.08.27-2.1.74-3H5c-1.1 0-2 .9-2 2v14c0 .55.23 1.05.59 1.41l9.82-9.82A6.435 6.435 0 0 1 11.5 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="subway">
      <circle cx="15.5" cy="16" r="1"/>
      <circle cx="8.5" cy="16" r="1"/>
      <path d="M7.01 9h10v5h-10zM17.8 2.8C16 2.09 13.86 2 12 2c-1.86 0-4 .09-5.8.8C3.53 3.84 2 6.05 2 8.86V22h20V8.86c0-2.81-1.53-5.02-4.2-6.06zm.2 13.08c0 1.45-1.18 2.62-2.63 2.62l1.13 1.12V20H15l-1.5-1.5h-2.83L9.17 20H7.5v-.38l1.12-1.12A2.63 2.63 0 0 1 6 15.88V9c0-2.63 3-3 6-3 3.32 0 6 .38 6 3v6.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="terrain">
      <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="traffic">
      <path d="M20 10h-3V8.86c1.72-.45 3-2 3-3.86h-3V4c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v1H4c0 1.86 1.28 3.41 3 3.86V10H4c0 1.86 1.28 3.41 3 3.86V15H4c0 1.86 1.28 3.41 3 3.86V20c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1.14c1.72-.45 3-2 3-3.86h-3v-1.14c1.72-.45 3-2 3-3.86zm-8 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0-5a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0-5a2 2 0 0 1-2-2c0-1.11.89-2 2-2a2 2 0 0 1 0 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="train">
      <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tram">
      <path d="M19 16.94V8.5c0-2.79-2.61-3.4-6.01-3.49l.76-1.51H17V2H7v1.5h4.75l-.76 1.52C7.86 5.11 5 5.73 5 8.5v8.44c0 1.45 1.19 2.66 2.59 2.97L6 21.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 20h-.08c1.69 0 2.58-1.37 2.58-3.06zm-7 1.56c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5-4.5H7V9h10v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="transfer-within-a-station">
      <path d="M16.49 15.5v-1.75L14 16.25l2.49 2.5V17H22v-1.5zm3.02 4.25H14v1.5h5.51V23L22 20.5 19.51 18zM9.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5.75 8.9L3 23h2.1l1.75-8L9 17v6h2v-7.55L8.95 13.4l.6-3C10.85 12 12.8 13 15 13v-2c-1.85 0-3.45-1-4.35-2.45l-.95-1.6C9.35 6.35 8.7 6 8 6c-.25 0-.5.05-.75.15L2 8.3V13h2V9.65l1.75-.75"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="zoom-out-map">
      <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6z"/>
    </symbol>
  </g>
  <g data-category="navigation">
    <symbol viewBox="0 0 24 24" id="apps">
      <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="arrow-back">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="arrow-downward">
      <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="arrow-drop-down">
      <path d="M7 10l5 5 5-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="arrow-drop-down-circle">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 12l-4-4h8l-4 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="arrow-drop-up">
      <path d="M7 14l5-5 5 5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="arrow-forward">
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="arrow-upward">
      <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="cancel">
      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="check">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="chevron-left">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="chevron-right">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="close">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="expand-less">
      <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="expand-more">
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="first-page">
      <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6zM6 6h2v12H6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fullscreen">
      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fullscreen-exit">
      <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="last-page">
      <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="menu">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="more-horiz">
      <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="more-vert">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="refresh">
      <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="subdirectory-arrow-left">
      <path d="M11 9l1.42 1.42L8.83 14H18V4h2v12H8.83l3.59 3.58L11 21l-6-6 6-6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="subdirectory-arrow-right">
      <path d="M19 15l-6 6-1.42-1.42L15.17 16H4V4h2v10h9.17l-3.59-3.58L13 9l6 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="unfold-less">
      <path d="M7.41 18.59L8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="unfold-more">
      <path d="M12 5.83L15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/>
    </symbol>
  </g>
  <g data-category="notification">
    <symbol viewBox="0 0 24 24" id="adb">
      <path d="M5 16c0 3.87 3.13 7 7 7s7-3.13 7-7v-4H5v4zM16.12 4.37l2.1-2.1-.82-.83-2.3 2.31C14.16 3.28 13.12 3 12 3s-2.16.28-3.09.75L6.6 1.44l-.82.83 2.1 2.1C6.14 5.64 5 7.68 5 10v1h14v-1c0-2.32-1.14-4.36-2.88-5.63zM9 9c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-flat">
      <path d="M22 11v2H9V7h9a4 4 0 0 1 4 4zM2 14v2h6v2h8v-2h6v-2H2zm5.14-1.9a3 3 0 0 0-.04-4.24 3 3 0 0 0-4.24.04 3 3 0 0 0 .04 4.24 3 3 0 0 0 4.24-.04z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-flat-angled">
      <path d="M22.25 14.29l-.69 1.89L9.2 11.71l2.08-5.66 8.56 3.09a4 4 0 0 1 2.41 5.15zM1.5 12.14L8 14.48V19h8v-1.63L20.52 19l.69-1.89-19.02-6.86-.69 1.89zm5.8-1.94a3.01 3.01 0 0 0 1.41-4A3.005 3.005 0 0 0 4.7 4.8a2.99 2.99 0 0 0-1.4 4 2.99 2.99 0 0 0 4 1.4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-individual-suite">
      <path d="M7 13c1.65 0 3-1.35 3-3S8.65 7 7 7s-3 1.35-3 3 1.35 3 3 3zm12-6h-8v7H3V7H1v10h22v-6a4 4 0 0 0-4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-legroom-extra">
      <path d="M4 12V3H2v9c0 2.76 2.24 5 5 5h6v-2H7c-1.66 0-3-1.34-3-3zm18.83 5.24c-.38-.72-1.29-.97-2.03-.63l-1.09.5-3.41-6.98a2.01 2.01 0 0 0-1.79-1.12L11 9V3H5v8c0 1.66 1.34 3 3 3h7l3.41 7 3.72-1.7c.77-.36 1.1-1.3.7-2.06z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-legroom-normal">
      <path d="M5 12V3H3v9c0 2.76 2.24 5 5 5h6v-2H8c-1.66 0-3-1.34-3-3zm15.5 6H19v-7c0-1.1-.9-2-2-2h-5V3H6v8c0 1.65 1.35 3 3 3h7v7h4.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-legroom-reduced">
      <path d="M19.97 19.2c.18.96-.55 1.8-1.47 1.8H14v-3l1-4H9c-1.65 0-3-1.35-3-3V3h6v6h5c1.1 0 2 .9 2 2l-2 7h1.44c.73 0 1.39.49 1.53 1.2zM5 12V3H3v9c0 2.76 2.24 5 5 5h4v-2H8c-1.66 0-3-1.34-3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-recline-extra">
      <path d="M5.35 5.64c-.9-.64-1.12-1.88-.49-2.79a2.01 2.01 0 0 1 2.79-.49c.9.64 1.12 1.88.49 2.79-.64.9-1.88 1.12-2.79.49zM16 19H8.93a2.99 2.99 0 0 1-2.96-2.54L4 7H2l1.99 9.76A5.01 5.01 0 0 0 8.94 21H16v-2zm.23-4h-4.88l-1.03-4.1c1.58.89 3.28 1.54 5.15 1.22V9.99c-1.63.31-3.44-.27-4.69-1.25L9.14 7.47c-.23-.18-.49-.3-.76-.38a2.21 2.21 0 0 0-.99-.06h-.02a2.268 2.268 0 0 0-1.84 2.61l1.35 5.92A3.008 3.008 0 0 0 9.83 18h6.85l3.82 3 1.5-1.5-5.77-4.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airline-seat-recline-normal">
      <path d="M7.59 5.41c-.78-.78-.78-2.05 0-2.83.78-.78 2.05-.78 2.83 0 .78.78.78 2.05 0 2.83-.79.79-2.05.79-2.83 0zM6 16V7H4v9c0 2.76 2.24 5 5 5h6v-2H9c-1.66 0-3-1.34-3-3zm14 4.07L14.93 15H11.5v-3.68c1.4 1.15 3.6 2.16 5.5 2.16v-2.16c-1.66.02-3.61-.87-4.67-2.04l-1.4-1.55c-.19-.21-.43-.38-.69-.5-.29-.14-.62-.23-.96-.23h-.03C8.01 7 7 8.01 7 9.25V15c0 1.66 1.34 3 3 3h5.07l3.5 3.5L20 20.07z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="bluetooth-audio">
      <path d="M14.24 12.01l2.32 2.32c.28-.72.44-1.51.44-2.33 0-.82-.16-1.59-.43-2.31l-2.33 2.32zm5.29-5.3l-1.26 1.26c.63 1.21.98 2.57.98 4.02s-.36 2.82-.98 4.02l1.2 1.2a9.936 9.936 0 0 0 1.54-5.31c-.01-1.89-.55-3.67-1.48-5.19zm-3.82 1L10 2H9v7.59L4.41 5 3 6.41 8.59 12 3 17.59 4.41 19 9 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM11 5.83l1.88 1.88L11 9.59V5.83zm1.88 10.46L11 18.17v-3.76l1.88 1.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="confirmation-number">
      <path d="M22 10V6a2 2 0 0 0-2-2H4c-1.1 0-1.99.89-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="disc-full">
      <path d="M20 16h2v-2h-2v2zm0-9v5h2V7h-2zM10 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 10c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="do-not-disturb">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31A7.902 7.902 0 0 1 12 20zm6.31-3.1L7.1 5.69A7.902 7.902 0 0 1 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="do-not-disturb-alt">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM4 12c0-4.4 3.6-8 8-8 1.8 0 3.5.6 4.9 1.7L5.7 16.9A7.88 7.88 0 0 1 4 12zm8 8c-1.8 0-3.5-.6-4.9-1.7L18.3 7.1C19.4 8.5 20 10.2 20 12c0 4.4-3.6 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="do-not-disturb-off">
      <path d="M17 11v2h-1.46l4.68 4.68A9.92 9.92 0 0 0 22 12c0-5.52-4.48-10-10-10-2.11 0-4.07.66-5.68 1.78L13.54 11H17zM2.27 2.27L1 3.54l2.78 2.78A9.92 9.92 0 0 0 2 12c0 5.52 4.48 10 10 10 2.11 0 4.07-.66 5.68-1.78L20.46 23l1.27-1.27L11 11 2.27 2.27zM7 13v-2h1.46l2 2H7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="do-not-disturb-on">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="drive-eta">
      <path d="M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="enhanced-encryption">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H8.9V6zM16 16h-3v3h-2v-3H8v-2h3v-3h2v3h3v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="event-available">
      <path d="M16.53 11.06L15.47 10l-4.88 4.88-2.12-2.12-1.06 1.06L10.59 17l5.94-5.94zM19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="event-busy">
      <path d="M9.31 17l2.44-2.44L14.19 17l1.06-1.06-2.44-2.44 2.44-2.44L14.19 10l-2.44 2.44L9.31 10l-1.06 1.06 2.44 2.44-2.44 2.44L9.31 17zM19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="event-note">
      <path d="M17 10H7v2h10v-2zm2-7h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-5-5H7v2h7v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="folder-special">
      <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2.06 11L15 15.28 12.06 17l.78-3.33-2.59-2.24 3.41-.29L15 8l1.34 3.14 3.41.29-2.59 2.24.78 3.33z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="live-tv">
      <path d="M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8a2 2 0 0 0-2-2zm0 14H3V8h18v12zM9 10v8l7-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mms">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM5 14l3.5-4.5 2.5 3.01L14.5 8l4.5 6H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="more">
      <path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.97.89 1.66.89H22c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 13.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="network-check">
      <path d="M15.9 5c-.17 0-.32.09-.41.23l-.07.15-5.18 11.65c-.16.29-.26.61-.26.96 0 1.11.9 2.01 2.01 2.01.96 0 1.77-.68 1.96-1.59l.01-.03L16.4 5.5c0-.28-.22-.5-.5-.5zM1 9l2 2c2.88-2.88 6.79-4.08 10.53-3.62l1.19-2.68C9.89 3.84 4.74 5.27 1 9zm20 2l2-2a15.367 15.367 0 0 0-5.59-3.57l-.53 2.82c1.5.62 2.9 1.53 4.12 2.75zm-4 4l2-2c-.8-.8-1.7-1.42-2.66-1.89l-.55 2.92c.42.27.83.59 1.21.97zM5 13l2 2a7.1 7.1 0 0 1 4.03-2l1.28-2.88c-2.63-.08-5.3.87-7.31 2.88z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="network-locked">
      <path d="M19.5 10c.17 0 .33.03.5.05V1L1 20h13v-3c0-.89.39-1.68 1-2.23v-.27c0-2.48 2.02-4.5 4.5-4.5zm2.5 6v-1.5a2.5 2.5 0 0 0-5 0V16c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h5c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1zm-1 0h-3v-1.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="no-encryption">
      <path d="M21 21.78L4.22 5 3 6.22l2.04 2.04C4.42 8.6 4 9.25 4 10v10c0 1.1.9 2 2 2h12c.23 0 .45-.05.66-.12L19.78 23 21 21.78zM8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H9.66L20 18.34V10c0-1.1-.9-2-2-2h-1V6c0-2.76-2.24-5-5-5-2.56 0-4.64 1.93-4.94 4.4L8.9 7.24V6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="ondemand-video">
      <path d="M21 3H3c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5a2 2 0 0 0-2-2zm0 14H3V5h18v12zm-5-6l-7 4V7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="personal-video">
      <path d="M21 3H3c-1.11 0-2 .89-2 2v12a2 2 0 0 0 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5a2 2 0 0 0-2-2zm0 14H3V5h18v12z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-bluetooth-speaker">
      <path d="M14.71 9.5L17 7.21V11h.5l2.85-2.85L18.21 6l2.15-2.15L17.5 1H17v3.79L14.71 2.5l-.71.71L16.79 6 14 8.79l.71.71zM18 2.91l.94.94-.94.94V2.91zm0 4.3l.94.94-.94.94V7.21zm2 8.29c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-forwarded">
      <path d="M18 11l5-5-5-5v3h-4v4h4v3zm2 4.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-in-talk">
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 12h2a9 9 0 0 0-9-9v2c3.87 0 7 3.13 7 7zm-4 0h2c0-2.76-2.24-5-5-5v2c1.66 0 3 1.34 3 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-locked">
      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM20 4v-.5a2.5 2.5 0 0 0-5 0V4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h5c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zm-.8 0h-3.4v-.5c0-.94.76-1.7 1.7-1.7s1.7.76 1.7 1.7V4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-missed">
      <path d="M6.5 5.5L12 11l7-7-1-1-6 6-4.5-4.5H11V3H5v6h1.5V5.5zm17.21 11.17A16.97 16.97 0 0 0 12 12C7.46 12 3.34 13.78.29 16.67c-.18.18-.29.43-.29.71s.11.53.29.71l2.48 2.48c.18.18.43.29.71.29.27 0 .52-.11.7-.28.79-.74 1.69-1.36 2.66-1.85.33-.16.56-.5.56-.9v-3.1c1.45-.48 3-.73 4.6-.73 1.6 0 3.15.25 4.6.72v3.1c0 .39.23.74.56.9.98.49 1.87 1.12 2.67 1.85.18.18.43.28.7.28.28 0 .53-.11.71-.29l2.48-2.48c.18-.18.29-.43.29-.71s-.12-.52-.3-.7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="phone-paused">
      <path d="M17 3h-2v7h2V3zm3 12.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.21a.96.96 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 3v7h2V3h-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="power">
      <path d="M16.01 7L16 3h-2v4h-4V3H8v4h-.01C7 6.99 6 7.99 6 8.99v5.49L9.5 18v3h5v-3l3.5-3.51v-5.5c0-1-1-2-1.99-1.99z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="priority-high">
      <circle cx="12" cy="19" r="2"/>
      <path d="M10 3h4v12h-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rv-hookup">
      <path d="M20 17v-6c0-1.1-.9-2-2-2H7V7l-3 3 3 3v-2h4v3H4v3c0 1.1.9 2 2 2h2c0 1.66 1.34 3 3 3s3-1.34 3-3h8v-2h-2zm-9 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7-6h-4v-3h4v3zM17 2v2H9v2h8v2l3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sd-card">
      <path d="M18 2h-8L4.02 8 4 20c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 6h-2V4h2v4zm3 0h-2V4h2v4zm3 0h-2V4h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sim-card-alert">
      <path d="M18 2h-8L4.02 8 4 20c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 15h-2v-2h2v2zm0-4h-2V8h2v5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sms">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sms-failed">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12h-2v-2h2v2zm0-4h-2V6h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sync">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sync-disabled">
      <path d="M10 6.35V4.26c-.8.21-1.55.54-2.23.96l1.46 1.46c.25-.12.5-.24.77-.33zm-7.14-.94l2.36 2.36a7.925 7.925 0 0 0 1.14 9.87L4 20h6v-6l-2.24 2.24A6.003 6.003 0 0 1 6 12c0-1 .25-1.94.68-2.77l8.08 8.08c-.25.13-.5.25-.77.34v2.09c.8-.21 1.55-.54 2.23-.96l2.36 2.36 1.27-1.27L4.14 4.14 2.86 5.41zM20 4h-6v6l2.24-2.24A6.003 6.003 0 0 1 18 12c0 1-.25 1.94-.68 2.77l1.46 1.46a7.925 7.925 0 0 0-1.14-9.87L20 4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sync-problem">
      <path d="M3 12c0 2.21.91 4.2 2.36 5.64L3 20h6v-6l-2.24 2.24A6.003 6.003 0 0 1 5 12a5.99 5.99 0 0 1 4-5.65V4.26C5.55 5.15 3 8.27 3 12zm8 5h2v-2h-2v2zM21 4h-6v6l2.24-2.24A6.003 6.003 0 0 1 19 12a5.99 5.99 0 0 1-4 5.65v2.09c3.45-.89 6-4.01 6-7.74 0-2.21-.91-4.2-2.36-5.64L21 4zm-10 9h2V7h-2v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="system-update">
      <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-1-6h-3V8h-2v5H8l4 4 4-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="tap-and-play">
      <path d="M2 16v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0 4v3h3c0-1.66-1.34-3-3-3zm0-8v2a9 9 0 0 1 9 9h2c0-6.08-4.92-11-11-11zM17 1.01L7 1c-1.1 0-2 .9-2 2v7.37c.69.16 1.36.37 2 .64V5h10v13h-3.03c.52 1.25.84 2.59.95 4H17c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="time-to-leave">
      <path d="M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="vibration">
      <path d="M0 15h2V9H0v6zm3 2h2V7H3v10zm19-8v6h2V9h-2zm-3 8h2V7h-2v10zM16.5 3h-9C6.67 3 6 3.67 6 4.5v15c0 .83.67 1.5 1.5 1.5h9c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5zM16 19H8V5h8v14z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="voice-chat">
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12l-4-3.2V14H6V6h8v3.2L18 6v8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="vpn-lock">
      <path d="M22 4v-.5a2.5 2.5 0 0 0-5 0V4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h5c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zm-.8 0h-3.4v-.5c0-.94.76-1.7 1.7-1.7s1.7.76 1.7 1.7V4zm-2.28 8c.04.33.08.66.08 1 0 2.08-.8 3.97-2.1 5.39-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H7v-2h2c.55 0 1-.45 1-1V8h2c1.1 0 2-.9 2-2V3.46c-.95-.3-1.95-.46-3-.46C5.48 3 1 7.48 1 13s4.48 10 10 10 10-4.48 10-10c0-.34-.02-.67-.05-1h-2.03zM10 20.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L8 16v1c0 1.1.9 2 2 2v1.93z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wc">
      <path d="M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22h-4zM18 22v-6h3l-2.54-7.63A2.01 2.01 0 0 0 16.56 7h-.12a2 2 0 0 0-1.9 1.37L12 16h3v6h3zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="wifi">
      <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 0 0-6 0zm-4-4l2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
    </symbol>
  </g>
  <g data-category="places">
    <symbol viewBox="0 0 24 24" id="ac-unit">
      <path d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="airport-shuttle">
      <path d="M17 5H3a2 2 0 0 0-2 2v9h2c0 1.65 1.34 3 3 3s3-1.35 3-3h5.5c0 1.65 1.34 3 3 3s3-1.35 3-3H23v-5l-6-6zM3 11V7h4v4H3zm3 6.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm7-6.5H9V7h4v4zm4.5 6.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM15 11V7h1l4 4h-5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="all-inclusive">
      <path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L12 10.66 10.48 12h.01L7.8 14.39c-.64.64-1.49.99-2.4.99-1.87 0-3.39-1.51-3.39-3.38S3.53 8.62 5.4 8.62c.91 0 1.76.35 2.44 1.03l1.13 1 1.51-1.34L9.22 8.2A5.37 5.37 0 0 0 5.4 6.62C2.42 6.62 0 9.04 0 12s2.42 5.38 5.4 5.38c1.44 0 2.8-.56 3.77-1.53l2.83-2.5.01.01L13.52 12h-.01l2.69-2.39c.64-.64 1.49-.99 2.4-.99 1.87 0 3.39 1.51 3.39 3.38s-1.52 3.38-3.39 3.38c-.9 0-1.76-.35-2.44-1.03l-1.14-1.01-1.51 1.34 1.27 1.12a5.386 5.386 0 0 0 3.82 1.57c2.98 0 5.4-2.41 5.4-5.38s-2.42-5.37-5.4-5.37z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="beach-access">
      <path d="M13.127 14.56l1.43-1.43 6.44 6.443L19.57 21zm4.293-5.73l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.02l-.01.01c-.38 3.01 1.17 6.88 4.3 10.02l5.73-5.73c-3.13-3.13-7.01-4.68-10.02-4.3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="business-center">
      <path d="M10 16v-1H3.01L3 19c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2v-4h-7v1h-4zm10-9h-4.01V5l-2-2h-4l-2 2v2H4c-1.1 0-2 .9-2 2v3c0 1.11.89 2 2 2h6v-2h4v2h6c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-6 0h-4V5h4v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="casino">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="child-care">
      <circle cx="14.5" cy="10.5" r="1.25"/>
      <circle cx="9.5" cy="10.5" r="1.25"/>
      <path d="M22.94 12.66c.04-.21.06-.43.06-.66s-.02-.45-.06-.66a4.008 4.008 0 0 0-2.81-3.17 9.114 9.114 0 0 0-2.19-2.91C16.36 3.85 14.28 3 12 3s-4.36.85-5.94 2.26c-.92.81-1.67 1.8-2.19 2.91a3.994 3.994 0 0 0-2.81 3.17c-.04.21-.06.43-.06.66s.02.45.06.66a4.008 4.008 0 0 0 2.81 3.17 8.977 8.977 0 0 0 2.17 2.89C7.62 20.14 9.71 21 12 21s4.38-.86 5.97-2.28c.9-.8 1.65-1.79 2.17-2.89a3.998 3.998 0 0 0 2.8-3.17zM19 14c-.1 0-.19-.02-.29-.03-.2.67-.49 1.29-.86 1.86C16.6 17.74 14.45 19 12 19s-4.6-1.26-5.85-3.17c-.37-.57-.66-1.19-.86-1.86-.1.01-.19.03-.29.03-1.1 0-2-.9-2-2s.9-2 2-2c.1 0 .19.02.29.03.2-.67.49-1.29.86-1.86C7.4 6.26 9.55 5 12 5s4.6 1.26 5.85 3.17c.37.57.66 1.19.86 1.86.1-.01.19-.03.29-.03 1.1 0 2 .9 2 2s-.9 2-2 2zM7.5 14c.76 1.77 2.49 3 4.5 3s3.74-1.23 4.5-3h-9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="child-friendly">
      <path d="M13 2v8h8c0-4.42-3.58-8-8-8zm6.32 13.89A7.948 7.948 0 0 0 21 11H6.44l-.95-2H2v2h2.22s1.89 4.07 2.12 4.42A3.49 3.49 0 0 0 4.5 18.5C4.5 20.43 6.07 22 8 22c1.76 0 3.22-1.3 3.46-3h2.08c.24 1.7 1.7 3 3.46 3 1.93 0 3.5-1.57 3.5-3.5 0-1.04-.46-1.97-1.18-2.61zM8 20c-.83 0-1.5-.67-1.5-1.5S7.17 17 8 17s1.5.67 1.5 1.5S8.83 20 8 20zm9 0c-.83 0-1.5-.67-1.5-1.5S16.17 17 17 17s1.5.67 1.5 1.5S17.83 20 17 20z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="fitness-center">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="free-breakfast">
      <path d="M20 3H4v10a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-3h2a2 2 0 0 0 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="golf-course">
      <circle cx="19.5" cy="19.5" r="1.5"/>
      <path d="M17 5.92L9 2v18H7v-1.73c-1.79.35-3 .99-3 1.73 0 1.1 2.69 2 6 2s6-.9 6-2c0-.99-2.16-1.81-5-1.97V8.98l6-3.06z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="hot-tub">
      <circle cx="7" cy="6" r="2"/>
      <path d="M11.15 12c-.31-.22-.59-.46-.82-.72l-1.4-1.55c-.19-.21-.43-.38-.69-.5-.29-.14-.62-.23-.96-.23h-.03C6.01 9 5 10.01 5 11.25V12H2v8c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-8H11.15zM7 20H5v-6h2v6zm4 0H9v-6h2v6zm4 0h-2v-6h2v6zm4 0h-2v-6h2v6zm-.35-14.14l-.07-.07c-.57-.62-.82-1.41-.67-2.2L18 3h-1.89l-.06.43c-.2 1.36.27 2.71 1.3 3.72l.07.06c.57.62.82 1.41.67 2.2l-.11.59h1.91l.06-.43c.21-1.36-.27-2.71-1.3-3.71zm-4 0l-.07-.07c-.57-.62-.82-1.41-.67-2.2L14 3h-1.89l-.06.43c-.2 1.36.27 2.71 1.3 3.72l.07.06c.57.62.82 1.41.67 2.2l-.11.59h1.91l.06-.43c.21-1.36-.27-2.71-1.3-3.71z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="kitchen">
      <path d="M18 2.01L6 2a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.11-.9-1.99-2-1.99zM18 20H6v-9.02h12V20zm0-11H6V4h12v5zM8 5h2v3H8zm0 7h2v5H8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pool">
      <path d="M22 21c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.08.64-2.19.64-1.11 0-1.73-.37-2.18-.64-.37-.23-.6-.36-1.15-.36s-.78.13-1.15.36c-.46.27-1.08.64-2.19.64v-2c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36v2zm0-4.5c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.45.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36s-.78.13-1.15.36c-.47.27-1.09.64-2.2.64v-2c.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36.56 0 .78-.13 1.15-.36.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.22.6.36 1.15.36v2zM8.67 12c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.12-.07.26-.15.41-.23L10.48 5C8.93 3.45 7.5 2.99 5 3v2.5c1.82-.01 2.89.39 4 1.5l1 1-3.25 3.25c.31.12.56.27.77.39.37.23.59.36 1.15.36z"/>
      <circle cx="16.5" cy="5.5" r="2.5"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="room-service">
      <path d="M2 17h20v2H2zm11.84-9.21A2.006 2.006 0 0 0 12 5a2.006 2.006 0 0 0-1.84 2.79C6.25 8.6 3.27 11.93 3 16h18c-.27-4.07-3.25-7.4-7.16-8.21z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="rv-hookup">
      <path d="M20 17v-6c0-1.1-.9-2-2-2H7V7l-3 3 3 3v-2h4v3H4v3c0 1.1.9 2 2 2h2c0 1.66 1.34 3 3 3s3-1.34 3-3h8v-2h-2zm-9 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7-6h-4v-3h4v3zM17 2v2H9v2h8v2l3-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="smoke-free">
      <path d="M2 6l6.99 7H2v3h9.99l7 7 1.26-1.25-17-17zm18.5 7H22v3h-1.5zM18 13h1.5v3H18zm.85-8.12c.62-.61 1-1.45 1-2.38h-1.5c0 1.02-.83 1.85-1.85 1.85v1.5c2.24 0 4 1.83 4 4.07V12H22V9.92c0-2.23-1.28-4.15-3.15-5.04zM14.5 8.7h1.53c1.05 0 1.97.74 1.97 2.05V12h1.5v-1.59c0-1.8-1.6-3.16-3.47-3.16H14.5c-1.02 0-1.85-.98-1.85-2s.83-1.75 1.85-1.75V2a3.35 3.35 0 0 0 0 6.7zm2.5 7.23V13h-2.93z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="smoking-rooms">
      <path d="M2 16h15v3H2zm18.5 0H22v3h-1.5zM18 16h1.5v3H18zm.85-8.27c.62-.61 1-1.45 1-2.38C19.85 3.5 18.35 2 16.5 2v1.5c1.02 0 1.85.83 1.85 1.85S17.52 7.2 16.5 7.2v1.5c2.24 0 4 1.83 4 4.07V15H22v-2.24c0-2.22-1.28-4.14-3.15-5.03zm-2.82 2.47H14.5c-1.02 0-1.85-.98-1.85-2s.83-1.75 1.85-1.75v-1.5a3.35 3.35 0 0 0 0 6.7h1.53c1.05 0 1.97.74 1.97 2.05V15h1.5v-1.64c0-1.81-1.6-3.16-3.47-3.16z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="spa">
      <path d="M8.55 12zm10.43-1.61z"/>
      <path d="M15.49 9.63c-.18-2.79-1.31-5.51-3.43-7.63a12.188 12.188 0 0 0-3.55 7.63c1.28.68 2.46 1.56 3.49 2.63 1.03-1.06 2.21-1.94 3.49-2.63zm-6.5 2.65c-.14-.1-.3-.19-.45-.29.15.11.31.19.45.29zm6.42-.25c-.13.09-.27.16-.4.26.13-.1.27-.17.4-.26zM12 15.45C9.85 12.17 6.18 10 2 10c0 5.32 3.36 9.82 8.03 11.49.63.23 1.29.4 1.97.51.68-.12 1.33-.29 1.97-.51C18.64 19.82 22 15.32 22 10c-4.18 0-7.85 2.17-10 5.45z"/>
    </symbol>
  </g>
  <g data-category="social">
    <symbol viewBox="0 0 24 24" id="cake">
      <path d="M12 6a2 2 0 0 0 2-2c0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12C21 10.34 19.66 9 18 9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="domain">
      <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="group">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="group-add">
      <path d="M8 10H5V7H3v3H0v2h3v3h2v-3h3v-2zm10 1c1.66 0 2.99-1.34 2.99-3S19.66 5 18 5c-.32 0-.63.05-.91.14.57.81.9 1.79.9 2.86s-.34 2.04-.9 2.86c.28.09.59.14.91.14zm-5 0c1.66 0 2.99-1.34 2.99-3S14.66 5 13 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm6.62 2.16c.83.73 1.38 1.66 1.38 2.84v2h3v-2c0-1.54-2.37-2.49-4.38-2.84zM13 13c-2 0-6 1-6 3v2h12v-2c0-2-4-3-6-3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="location-city">
      <path d="M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mood">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="mood-bad">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 3c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="notifications">
      <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="notifications-active">
      <path d="M7.58 4.08L6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2a8.445 8.445 0 0 1 3.55-6.42zm12.39 6.42h2a10.49 10.49 0 0 0-4.12-7.85l-1.42 1.43a8.495 8.495 0 0 1 3.54 6.42zM18 11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2v-5zm-6 11c.14 0 .27-.01.4-.04a2.03 2.03 0 0 0 1.44-1.18c.1-.24.15-.5.15-.78h-4c.01 1.1.9 2 2.01 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="notifications-none">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="notifications-off">
      <path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.72l-1-1.03zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm6-7.32V11c0-3.08-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-.15.03-.29.08-.42.12-.1.03-.2.07-.3.11h-.01c-.01 0-.01 0-.02.01-.23.09-.46.2-.68.31 0 0-.01 0-.01.01L18 14.68z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="notifications-paused">
      <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.93 6 11v5l-2 2v1h16v-1l-2-2zm-3.5-6.2l-2.8 3.4h2.8V15h-5v-1.8l2.8-3.4H9.5V8h5v1.8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="pages">
      <path d="M3 5v6h5L7 7l4 1V3H5c-1.1 0-2 .9-2 2zm5 8H3v6c0 1.1.9 2 2 2h6v-5l-4 1 1-4zm9 4l-4-1v5h6c1.1 0 2-.9 2-2v-6h-5l1 4zm2-14h-6v5l4-1-1 4h5V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="party-mode">
      <path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 3c1.63 0 3.06.79 3.98 2H12c-1.66 0-3 1.34-3 3 0 .35.07.69.18 1H7.1A5.002 5.002 0 0 1 12 7zm0 10c-1.63 0-3.06-.79-3.98-2H12c1.66 0 3-1.34 3-3 0-.35-.07-.69-.18-1h2.08a5.002 5.002 0 0 1-4.9 6z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="people">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="people-outline">
      <path d="M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 5.5c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5zm0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="person">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="person-add">
      <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="person-outline">
      <path d="M12 5.9a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2m0 9c2.97 0 6.1 1.46 6.1 2.1v1.1H5.9V17c0-.64 3.13-2.1 6.1-2.1M12 4C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="plus-one">
      <path d="M10 8H8v4H4v2h4v4h2v-4h4v-2h-4zm4.5-1.92V7.9l2.5-.5V18h2V5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="poll">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="public">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="school">
      <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sentiment-dissatisfied">
      <circle cx="15.5" cy="9.5" r="1.5"/>
      <circle cx="8.5" cy="9.5" r="1.5"/>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-6c-2.33 0-4.32 1.45-5.12 3.5h1.67c.69-1.19 1.97-2 3.45-2s2.75.81 3.45 2h1.67c-.8-2.05-2.79-3.5-5.12-3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sentiment-neutral">
      <path d="M9 14h6v1.5H9z"/>
      <circle cx="15.5" cy="9.5" r="1.5"/>
      <circle cx="8.5" cy="9.5" r="1.5"/>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sentiment-satisfied">
      <circle cx="15.5" cy="9.5" r="1.5"/>
      <circle cx="8.5" cy="9.5" r="1.5"/>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-4c-1.48 0-2.75-.81-3.45-2H6.88a5.495 5.495 0 0 0 10.24 0h-1.67c-.7 1.19-1.97 2-3.45 2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sentiment-very-dissatisfied">
      <path d="M11.99 2C6.47 2 2 6.47 2 12s4.47 10 9.99 10S22 17.53 22 12 17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm4.18-12.24l-1.06 1.06-1.06-1.06L13 8.82l1.06 1.06L13 10.94 14.06 12l1.06-1.06L16.18 12l1.06-1.06-1.06-1.06 1.06-1.06zM7.82 12l1.06-1.06L9.94 12 11 10.94 9.94 9.88 11 8.82 9.94 7.76 8.88 8.82 7.82 7.76 6.76 8.82l1.06 1.06-1.06 1.06zM12 14c-2.33 0-4.31 1.46-5.11 3.5h10.22c-.8-2.04-2.78-3.5-5.11-3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="sentiment-very-satisfied">
      <path d="M11.99 2C6.47 2 2 6.47 2 12s4.47 10 9.99 10S22 17.53 22 12 17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm1-10.06L14.06 11l1.06-1.06L16.18 11l1.06-1.06-2.12-2.12zm-4.12 0L9.94 11 11 9.94 8.88 7.82 6.76 9.94 7.82 11zM12 17.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="share">
      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="whatshot">
      <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04a4.8 4.8 0 0 1-4.8 4.8z"/>
    </symbol>
  </g>
  <g data-category="toggle">
    <symbol viewBox="0 0 24 24" id="check-box">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="check-box-outline-blank">
      <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="indeterminate-check-box">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="radio-button-checked">
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="radio-button-unchecked">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="star">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="star-border">
      <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="star-half">
      <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4V6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/>
    </symbol>
  </g>
</svg>`;

  customElements.define("x-icon", XIconElement);

  let $oldTabIndex$4 = Symbol();

  let shadowTemplate$c = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        max-width: 140px;
        height: 24px;
        box-sizing: border-box;
        color: #000000;
        background: white;
        --selection-color: currentColor;
        --selection-background: #B2D7FD;
        --inner-padding: 0;
      }
      :host(:focus) {
        z-index: 10;
      }
      :host(:hover) {
        cursor: text;
      }
      :host([error]) {
        --selection-color: white;
        --selection-background: #d50000;
      }
      :host([readonly]) {
        color: rgba(0, 0, 0, 0.75);
      }
      :host([mixed]) {
        color: rgba(0, 0, 0, 0.7);
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      ::selection {
        color: var(--selection-color);
        background: var(--selection-background);
      }

      #main {
        display: flex;
        align-items: center;
        width: 100%;
        height: 100%;
      }

      #input {
        width: 100%;
        height: 100%;
        padding: var(--inner-padding);
        box-sizing: border-box;
        color: inherit;
        background: none;
        border: none;
        outline: none;
        font-family: inherit;
        font-size: inherit;
        font-weight: inherit;
        text-align: inherit;
        cursor: inherit;
      }
      #input:-webkit-autofill {
        /* Hide the placehodler text when the input is autofilled */
        z-index: 1;
      }

      /* Selection rect */
      :host(:not(:focus)) ::selection {
        color: inherit;
        background: transparent;
      }

      /* Error */
      :host([error])::before {
        position: absolute;
        left: 0;
        top: 26px;
        box-sizing: border-box;
        color: #d50000;
        font-family: inherit;
        font-size: 11px;
        line-height: 1.2;
        white-space: pre;
        content: attr(error);
      }
    </style>

    <main id="main">
      <slot></slot>
      <input id="input" spellcheck="false"></input>
    </main>
  </template>
`;

  // @events
  //   input
  //   change
  //   textinputmodestart
  //   textinputmodeend
  class XInputElement extends HTMLElement {
    static get observedAttributes() {
      return ["type", "value", "spellcheck", "maxlength", "readonly", "disabled", "validation"];
    }

    // @type
    //   "text" || "email" || "password" || "url" || "color"
    // @default
    //   "text"
    // @attribute
    get type() {
      return this.hasAttribute("type") ? this.getAttribute("type") : "text";
    }
    set type(type) {
      this.setAttribute("type", type);
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    //   partial
    get value() {
      return this["#input"].value;
    }
    set value(value) {
      if (this["#input"].value !== value) {
        if (this.matches(":focus")) {
          // https://goo.gl/s1UnHh
          this["#input"].selectionStart = 0;
          this["#input"].selectionEnd = this["#input"].value.length;
          document.execCommand("insertText", false, value);
        }
        else {
          this["#input"].value = value;
        }

        if (this.validation === "instant") {
          this.validate();
        }
        else if (this.validation === "auto" || this.validation === "manual") {
          if (this.error !== null) {
            this.validate();
          }
        }

        this._updateEmptyState();
      }
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get spellcheck() {
      return this.hasAttribute("spellcheck");
    }
    set spellcheck(spellcheck) {
      spellcheck ? this.setAttribute("spellcheck", "") : this.removeAttribute("spellcheck");
    }

    // @type
    //   number
    // @default
    //   0
    // @attribute
    get minLength() {
      return this.hasAttribute("minlength") ? parseInt(this.getAttribute("minlength")) : 0;
    }
    set minLength(minLength) {
      this.setAttribute("minlength", minLength);
    }

    // @type
    //   number || Infinity
    // @default
    //   0
    // @attribute
    get maxLength() {
      return this.hasAttribute("maxlength") ? parseInt(this.getAttribute("maxlength")) : Infinity;
    }
    set maxLength(maxLength) {
      this.setAttribute("maxlength", maxLength);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get required() {
      return this.hasAttribute("required");
    }
    set required(required) {
      required ? this.setAttribute("required", "") : this.removeAttribute("required");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @atrribute
    get readOnly() {
      return this.hasAttribute("readonly");
    }
    set readOnly(readOnly) {
      readOnly === true ? this.setAttribute("readonly", readOnly) : this.removeAttribute("readonly");
    }

    // @info
    //   Whether this input has "mixed" state.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    // @info
    //   "auto"    - validate() is called when input loses focus and when user presses "Enter"
    //   "instant" - validate() is called on each key press
    //   "manual"  - you will call validate() manually when user submits the form
    // @type
    //   "auto" || "instant" || "manual"
    // @default
    //   "auto"
    get validation() {
      return this.hasAttribute("validation") ? this.getAttribute("validation") : "auto";
    }
    set validation(validation) {
      this.setAttribute("validation", validation);
    }

    // @type
    //   string?
    // @default
    //   null
    // @attribute
    get error() {
      return this.getAttribute("error");
    }
    set error(error) {
      error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate$c.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("focusin", (event) => this._onFocusIn(event));
      this.addEventListener("focusout", (event) => this._onFocusOut(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));

      this["#input"].addEventListener("change", (event) => this._onInputChange(event));
      this["#input"].addEventListener("input", (event) => this._onInputInput(event));
      this["#input"].addEventListener("search", (event) => this._onInputSearch(event));
    }

    connectedCallback() {
      this._updateAccessabilityAttributes();
      this._updateEmptyState();

      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }

    attributeChangedCallback(name) {
      if (name === "type") {
        this._onTypeAttributeChange();
      }
      else if (name === "value") {
        this._onValueAttributeChange();
      }
      else if (name === "spellcheck") {
        this._onSpellcheckAttributeChange();
      }
      else if (name === "maxlength") {
        this._onMaxLengthAttributeChange();
      }
      else if (name === "readonly") {
        this._onReadOnlyAttributeChnage();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
      else if (name === "validation") {
        this._onValidationAttributeChnage();
      }
    }

    // @info
    //   Override this method to validate the input value manually.
    // @type
    //   () => void
    validate() {
      if (this.value.length < this.minLength) {
        this.error = "Entered text is too short";
      }
      else if (this.value.length > this.maxLength) {
        this.error = "Entered text is too long";
      }
      else if (this.required && this.value.length === 0) {
        this.error = "This field is required";
      }
      else if (this.type === "email" && this["#input"].validity.valid === false) {
        this.error = "Invalid e-mail address";
      }
      else if (this.type === "url" && this["#input"].validity.valid === false) {
        this.error = "Invalid URL";
      }
      else if (this.type === "color" && isValidColorString(this["#input"].value) === false) {
        this.error = "Invalid color";
      }
      else {
        this.error = null;
      }
    }

    selectAll() {
      this["#input"].select();
    }

    clear() {
      this.value = "";
      this.error = null;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateEmptyState() {
      if (this.value.length === 0) {
        this.setAttribute("empty", "");
      }
      else {
        this.removeAttribute("empty");
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "input");
      this.setAttribute("aria-disabled", this.disabled);
      this.setAttribute("aria-readonly", this.readOnly);

      if (this.disabled) {
        this[$oldTabIndex$4] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$4] > 0) ? this[$oldTabIndex$4] : 0;
        }

        delete this[$oldTabIndex$4];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onTypeAttributeChange() {
      if (this.type === "color") {
        this["#input"].type = "text";
      }
      else {
        this["#input"].type = this.type;
      }
    }

    _onValueAttributeChange() {
      this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

      if (this.matches(":focus")) {
        this.selectAll();
      }
    }

    _onSpellcheckAttributeChange() {
      this["#input"].spellcheck = this.spellcheck;
    }

    _onMaxLengthAttributeChange() {
      this["#input"].maxLength = this.maxLength;
    }

    _onReadOnlyAttributeChnage() {
      this["#input"].readOnly = this.readOnly;
      this._updateAccessabilityAttributes();
    }

    _onDisabledAttributeChange() {
      this["#input"].disabled = this.disabled;
      this._updateAccessabilityAttributes();
    }

    _onValidationAttributeChnage() {
      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }

    _onFocusIn() {
      this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
    }

    _onFocusOut() {
      this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));

      if (this.validation === "auto") {
        this.validate();
      }
    }

    _onKeyDown(event) {
      if (event.key === "Enter") {
        document.execCommand("selectAll");

        if (this.validation === "instant") {
          this.validate();
        }
        else if (this.validation === "auto" || this.validation === "manual") {
          if (this.error !== null) {
            this.validate();
          }
        }
      }
    }

    _onInputInput(event) {
      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }

      event.stopPropagation();
      this._updateEmptyState();
      this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
    }

    _onInputChange() {
      if (this.type !== "search") {
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    }

    _onInputSearch() {
      this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
    }
  }

  customElements.define("x-input", XInputElement);

  let shadowTemplate$d = html`
  <template>
    <style>
      :host {
        display: block;
        line-height: 1.2;
        user-select: none;
        box-sizing: border-box;
      }
      :host([disabled]) {
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      slot {
        text-decoration: inherit;
      }
    </style>

    <slot></slot>
  </template>
`;

  class XLabelElement extends HTMLElement {
    static get observedAttributes() {
      return ["for"];
    }

    // @info
    //   Values associated with this label.
    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @info
    //   Source of the icon to show.
    // @type
    //   string
    // @attribute
    get for() {
      return this.getAttribute("for");
    }
    set for(value) {
      this.setAttribute("for", value);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$d.content, true));

      this.addEventListener("click", (event) => this._onClick(event));
    }

    attributeChangedCallback(name) {
      if (name === "for") {
        this._onForAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onClick(event) {
      if (this.for && this.disabled === false && event.target.closest("a") === null) {
        let target = this.getRootNode().querySelector("#" + CSS.escape(this.for));

        if (target) {
          target.click();
        }
      }
    }

    _onForAttributeChange() {
      let rootNode = this.getRootNode();
      let target = rootNode.querySelector("#" + CSS.escape(this.for));

      if  (target) {
        if (!this.id) {
          this.id = generateUniqueID(rootNode, "label-");
        }

        target.setAttribute("aria-labelledby", this.id);
      }
    }
  }

  customElements.define("x-label", XLabelElement);

  let {abs} = Math;
  let windowWhitespace = 7;

  let shadowTemplate$e = html`
  <template>
    <style>
      :host {
        display: none;
        top: 0;
        left: 0;
        width: fit-content;
        z-index: 1001;
        box-sizing: border-box;
        background: white;
        cursor: default;
        overflow: auto;
        flex-direction: column;
        -webkit-app-region: no-drag;
        --align: start;
        --scrollbar-background: rgba(0, 0, 0, 0.2);
        --scrollbar-width: 6px;
        --open-transition: 100 transform cubic-bezier(0.4, 0, 0.2, 1);
        --close-transition: 200 opacity cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host([opened]),
      :host([animating]) {
        display: flex;
      }
      :host(:focus) {
        outline: none;
      }
      :host-context([debug]):host(:focus) {
        outline: 2px solid red;
      }


      ::-webkit-scrollbar {
        max-width: var(--scrollbar-width);
        background: none;
      }
      ::-webkit-scrollbar-thumb {
        background-color: var(--scrollbar-background);
      }
      ::-webkit-scrollbar-corner {
        display: none
      }
    </style>

    <slot id="slot"></slot>
  </template>
`;

  // @events
  //   open XMenu
  //   close XMenu
  class XMenuElement extends HTMLElement {
    static get observedAttributes() {
      return ["opened"];
    }

    // @info
    //   Whether the menu is shown on screen.
    // @type
    //   boolean
    // @readonly
    // @attribute
    get opened() {
      return this.hasAttribute("opened");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._delayPoints = [];
      this._delayTimeoutID = null;
      this._lastDelayPoint = null;

      this._extraTop = 0;
      this._lastScrollTop = 0;
      this._isPointerOverMenuBlock = false;
      this._expandWhenScrolled = false;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$e.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("pointerover", (event) => this._onPointerOver(event));
      this.addEventListener("pointerout", (event) => this._onPointerOut(event));
      this.addEventListener("pointermove", (event) => this._onPointerMove(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
      this.addEventListener("wheel", (event) => this._onWheel(event), {passive: false});
      this.addEventListener("scroll", (event) => this._onScroll(event), {passive: true});
    }

    connectedCallback() {
      this.setAttribute("role", "menu");
      this.setAttribute("aria-hidden", !this.opened);
      this.setAttribute("tabindex", "0");
    }

    attributeChangedCallback(name) {
      if (name === "opened") {
        this._onOpenedAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Open the menu so that overElement (belonging to the menu) is positioned directly over underElement.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (HTMLElement, HTMLElement) => Promise<>
    openOverElement(underElement, overElement) {
      return new Promise( async (resolve) => {
        let items = this.querySelectorAll(":scope > x-menuitem");

        if (items.length > 0) {
          this._expandWhenScrolled = true;
          this._openedTimestamp = getTimeStamp();
          this._resetInlineStyles();
          this.setAttribute("opened", "");

          let menuItem = [...items].find((item) => item.contains(overElement)) || items[0];
          let menuBounds = this.getBoundingClientRect();
          let underElementBounds = underElement.getBoundingClientRect();
          let overElementBounds = overElement.getBoundingClientRect();

          let extraLeft = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)
          let extraTop = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)

          menuItem.focus();

          // Determine extraLeft and extraTop which represent the extra offset when the menu is inside another
          // fixed-positioned element such as a popover.
          {
            if (menuBounds.top !== 0 || menuBounds.left !== 0) {
              extraLeft = -menuBounds.left;
              extraTop = -menuBounds.top;
            }
          }

          // Position the menu so that the underElement is directly above the overLabel
          {
            this.style.left = (underElementBounds.x - (overElementBounds.x - menuBounds.x) + extraLeft) + "px";
            this.style.top = (underElementBounds.y - (overElementBounds.y - menuBounds.y) + extraTop) + "px";
            menuBounds = this.getBoundingClientRect();
          }

          // Move the menu right if it overflows the left client bound
          {
            if (menuBounds.left < windowWhitespace) {
              this.style.left = (windowWhitespace + extraLeft) + "px";
              menuBounds = this.getBoundingClientRect();
            }
          }

          // Reduce the menu height if it overflows the top client bound
          {
            let overflowTop = windowWhitespace - menuBounds.top;

            if (overflowTop > 0) {
              this.style.height = (menuBounds.bottom - windowWhitespace) + "px";
              this.style.top = (windowWhitespace + extraTop) + "px";
              this.scrollTop = 9999;
              menuBounds = this.getBoundingClientRect();
            }
          }

          // Reduce menu height if it overflows the bottom client bound
          // Reduce menu width if it overflows the right client bound
          {
            if (menuBounds.bottom + windowWhitespace > window.innerHeight) {
              let overflow = menuBounds.bottom - window.innerHeight;
              let height = menuBounds.height - overflow - windowWhitespace;
              this.style.height = height + "px";
            }

            if (menuBounds.right + windowWhitespace > window.innerWidth) {
              let overflow = menuBounds.right - window.innerWidth;
              let width = menuBounds.width - overflow - windowWhitespace;
              this.style.width = `${width}px`;
            }
          }

          // Animate the menu block
          {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              let blockBounds = this.getBoundingClientRect();
              let originY = underElementBounds.y + underElementBounds.height/2 - blockBounds.top;

              await this.animate(
                {
                  transform: ["scaleY(0)", "scaleY(1)"],
                  transformOrigin: [`0 ${originY}px`, `0 ${originY}px`]
                },
                { duration, easing }
              ).finished;
            }
          }

          this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
          this._extraTop = extraTop;
        }

        resolve();
      });
    }

    // @info
    //   Open the menu over the given <x-label> element.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (XMenuItem) => Promise<>
    openOverLabel(underLabel) {
      return new Promise( async (resolve) => {
        let items = this.querySelectorAll(":scope > x-menuitem");

        if (items.length > 0) {
          this._resetInlineStyles();
          this.setAttribute("opened", "");
          this._expandWhenScrolled = true;
          this._openedTimestamp = getTimeStamp();

          let item = [...items].find((item) => {
            let itemLabel = item.querySelector("x-label");
            return (itemLabel && itemLabel.textContent === underLabel.textContent) ? true : false;
          });

          if (!item) {
            item = items[0];
          }

          let overLabel = item.querySelector("x-label");
          await this.openOverElement(underLabel, overLabel);
        }

        resolve();
      });
    }

    // @info
    //   Open the menu next the given menu item.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (XMenuItem, string) => Promise
    openNextToElement(element, direction = "horizontal", elementWhitespace = 0) {
      return new Promise(async (resolve) => {
        this._expandWhenScrolled = false;
        this._openedTimestamp = getTimeStamp();

        this._resetInlineStyles();
        this.setAttribute("opened", "");
        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));

        if (element.localName === "x-menuitem") {
          element.setAttribute("expanded", "");
        }

        let align = getComputedStyle(this).getPropertyValue("--align").trim();
        let elementBounds = element.getBoundingClientRect();
        let menuBounds = this.getBoundingClientRect();
        let extraLeft = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)
        let extraTop = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)

        // Determine extraLeft and extraTop which represent the extra offset when the menu is inside another
        // fixed-positioned element such as a popover.
        {
          if (menuBounds.top !== 0 || menuBounds.left !== 0) {
            extraLeft = -menuBounds.left;
            extraTop = -menuBounds.top;
          }
        }

        if (direction === "horizontal") {
          this.style.top = (elementBounds.top + extraTop) + "px";
          this.style.left = (elementBounds.left + elementBounds.width + elementWhitespace + extraLeft) + "px";

          let side = "right";

          // Reduce menu size if it does not fit on screen
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.width > window.innerWidth - 10) {
              this.style.width = (window.innerWidth - 10) + "px";
            }

            if (menuBounds.height > window.innerHeight - 10) {
              this.style.height = (window.innerHeight - 10) + "px";
            }
          }

          // Move the menu horizontally if it overflows the right screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.left + menuBounds.width + windowWhitespace > window.innerWidth) {
              // Move menu to the left side of the element if there is enough space to fit it in
              if (elementBounds.left > menuBounds.width + windowWhitespace) {
                this.style.left = (elementBounds.left - menuBounds.width + extraLeft) + "px";
                side = "left";
              }
              // ... otherwise move menu to the screen edge
              else {
                // Move menu to the left screen edge
                if (elementBounds.left > window.innerWidth - (elementBounds.left + elementBounds.width)) {
                  this.style.left = (windowWhitespace + extraLeft) + "px";
                  side = "left";
                }
                // Move menu to the right screen edge
                else {
                  this.style.left = (window.innerWidth - menuBounds.width - windowWhitespace + extraLeft) + "px";
                  side = "right";
                }
              }
            }
          }

          // Move the menu vertically it overflows the bottom screen edge
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.top + menuBounds.height + windowWhitespace > window.innerHeight) {
              let bottomOverflow = (menuBounds.top + menuBounds.height + windowWhitespace) - window.innerHeight;
              this.style.top = (menuBounds.top - bottomOverflow + extraTop) + "px";
            }
          }

          // Animate the menu
          {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              await this.animate(
                {
                  transform: ["scale(0, 0)", "scale(1, 1)"],
                  transformOrigin: [side === "left" ? "100% 0" : "0 0", side === "left" ? "100% 0" : "0 0"]
                },
                { duration, easing }
              ).finished;
            }
          }
        }

        else if (direction === "vertical") {
          this.style.top = (elementBounds.top + elementBounds.height + elementWhitespace + extraTop) + "px";
          this.style.left = "0px";

          let side = "bottom";

          // Reduce menu size if it does not fit on screen
          {
            let menuBounds = this.getBoundingClientRect();

            if (menuBounds.width > window.innerWidth - 10) {
              this.style.width = (window.innerWidth - 10) + "px";
            }

            if (menuBounds.height > window.innerHeight - 10) {
              this.style.height = (window.innerHeight - 10) + "px";
            }
          }

          if (element.parentElement && element.parentElement.localName === "x-menubar") {
            let menuBounds = this.getBoundingClientRect();

            // Reduce menu height if it overflows bottom screen edge
            if (menuBounds.top + menuBounds.height + windowWhitespace > window.innerHeight) {
              this.style.height = (window.innerHeight - (elementBounds.top + elementBounds.height) - 10) + "px";
            }
          }
          else {
            // Move the menu vertically if it overflows the bottom screen edge
            {
              let menuBounds = this.getBoundingClientRect();

              if (menuBounds.top + menuBounds.height + windowWhitespace > window.innerHeight) {
                // Move menu to the top side of the element if there is enough space to fit it in
                if (elementBounds.top > menuBounds.height + windowWhitespace) {
                  this.style.top = (elementBounds.top - menuBounds.height - elementWhitespace + extraTop) + "px";
                  side = "top";
                }
                // ... otherwise move menu to the screen edge
                else {
                  // Move menu to the top screen edge
                  if (elementBounds.top > window.innerHeight - (elementBounds.top + elementBounds.height)) {
                    this.style.top = (windowWhitespace + extraTop) + "px";
                    side = "top";
                  }
                  // Move menu to the bottom screen edge
                  else {
                    this.style.top = (window.innerHeight - menuBounds.height - windowWhitespace + extraTop) + "px";
                    side = "bottom";
                  }
                }
              }
            }
          }

          if (align === "start") {
            this.style.left = (elementBounds.left + extraLeft) + "px";

            // Float the menu to the right element edge if the menu overflows right screen edge
            {
              let menuBounds = this.getBoundingClientRect();

              if (menuBounds.left + menuBounds.width + windowWhitespace > window.innerWidth) {
                this.style.left = (elementBounds.left + elementBounds.width - menuBounds.width + extraLeft) + "px";
              }
            }

            // Float the menu to the left screen edge if it overflows the left screen edge
            {
              let menuBounds = this.getBoundingClientRect();

              if (menuBounds.left < windowWhitespace) {
                this.style.left = (windowWhitespace + extraLeft) + "px";
              }
            }
          }
          else if (align === "end") {
            this.style.left = (elementBounds.left + elementBounds.width - menuBounds.width + extraLeft) + "px";

            // Float the menu to the left element edge if the menu overflows left screen edge
            {
              let menuBounds = this.getBoundingClientRect();

              if (menuBounds.left < windowWhitespace) {
                this.style.left = (elementBounds.left + extraLeft) + "px";
              }
            }

            // Float the menu to the right screen edge if it overflows the right screen edge
            {
              let menuBounds = this.getBoundingClientRect();

              if (menuBounds.left + menuBounds.width + windowWhitespace > window.innerWidth) {
                this.style.left = (window.innerWidth - windowWhitespace + extraLeft) + "px";
              }
            }
          }

          // Animate the menu
          {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              await this.animate(
                {
                  transform: ["scale(1, 0)", "scale(1, 1)"],
                  transformOrigin: [side === "top" ? "0 100%" : "0 0", side === "top" ? "0 100%" : "0 0"]
                },
                { duration, easing }
              ).finished;
            }
          }
        }

        this._extraTop = extraTop;
        resolve();
      });
    }

    // @info
    //   Open the menu at given client point.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (number, number) => Promise
    openAtPoint(left, top) {
      return new Promise( async (resolve) => {
        this._expandWhenScrolled = false;
        this._openedTimestamp = getTimeStamp();

        this._resetInlineStyles();
        this.setAttribute("opened", "");
        this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));

        let menuBounds = this.getBoundingClientRect();
        let extraLeft = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)
        let extraTop = 0; // Extra offset needed when menu has fixed-positioned ancestor(s)

        // Determine extraLeft and extraTop which represent the extra offset when the menu is inside another
        // fixed-positioned element such as a popover.
        {
          if (menuBounds.top !== 0 || menuBounds.left !== 0) {
            extraLeft = -menuBounds.left;
            extraTop = -menuBounds.top;
          }
        }

        // Position the menu at given point
        {
          this.style.left = (left + extraLeft) + "px";
          this.style.top = (top + extraTop) + "px";
          menuBounds = this.getBoundingClientRect();
        }

        // If menu overflows right screen border then move it to the opposite side
        if (menuBounds.right + windowWhitespace > window.innerWidth) {
          left = left - menuBounds.width;
          this.style.left = (left + extraLeft) + "px";
          menuBounds = this.getBoundingClientRect();
        }

        // If menu overflows bottom screen border then move it up
        if (menuBounds.bottom + windowWhitespace > window.innerHeight) {
          top = top + window.innerHeight - (menuBounds.top + menuBounds.height) - windowWhitespace;
          this.style.top = (top + extraTop) + "px";
          menuBounds = this.getBoundingClientRect();

          // If menu now overflows top screen border then make it stretch to the whole available vertical space

          if (menuBounds.top < windowWhitespace) {
            top = windowWhitespace;
            this.style.top = (top + extraTop) + "px";
            this.style.height = (window.innerHeight - windowWhitespace - windowWhitespace) + "px";
          }
        }

        // Animate the menu
        {
          let transition = getComputedStyle(this).getPropertyValue("--open-transition");
          let [property, duration, easing] = this._parseTransistion(transition);

          if (property === "transform") {
            await this.animate(
              {
                transform: ["scale(0)", "scale(1)"],
                transformOrigin: ["0 0", "0 0"]
              },
              {
                duration: 80,
                easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
              }
            ).finished;
          }
        }

        this._extraTop = extraTop;
        resolve();
      });
    }

    // @info
    //   Close the menu.
    //   Returns a promise that is resolved when the menu finishes animating.
    // @type
    //   (boolean) => Promise
    close(animate = true) {
      return new Promise(async (resolve) => {
        if (this.opened) {
          this.removeAttribute("opened");
          this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));

          let item = this.closest("x-menuitem");

          if (item) {
            item.removeAttribute("expanded");
          }

          if (animate) {
            this.setAttribute("animating", "");

            let transition = getComputedStyle(this).getPropertyValue("--close-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "opacity") {
              await this.animate({ opacity: ["1", "0"] }, { duration, easing }).finished;
            }

            this.removeAttribute("animating");
          }

          for (let item of this.querySelectorAll(":scope > x-menuitem")) {
            let submenu = item.querySelector("x-menu[opened]");

            if (submenu) {
              submenu.close();
            }
          }
        }

        resolve();
      });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    focusNextMenuItem() {
      let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

      if (refItem) {
        let nextItem = null;

        for (let item = refItem.nextElementSibling; item; item = item.nextElementSibling) {
          if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
            nextItem = item;
            break;
          }
        }

        if (nextItem === null && refItem.parentElement != null) {
          for (let item of refItem.parentElement.children) {
            if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
              nextItem = item;
              break;
            }
          }
        }

        if (nextItem) {
          nextItem.focus();

          let menu = refItem.querySelector("x-menu");

          if (menu) {
            menu.close();
          }
        }
      }
      else {
        this.focusFirstMenuItem();
      }
    }

    focusPreviousMenuItem() {
      let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

      if (refItem) {
        let previousItem = null;

        for (let item = refItem.previousElementSibling; item; item = item.previousElementSibling) {
          if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
            previousItem = item;
            break;
          }
        }

        if (previousItem === null && refItem.parentElement != null) {
          for (let item of [...refItem.parentElement.children].reverse()) {
            if (item.localName === "x-menuitem" && item.disabled === false && item.hidden === false) {
              previousItem = item;
              break;
            }
          }
        }

        if (previousItem) {
          previousItem.focus();

          let menu = refItem.querySelector("x-menu");

          if (menu) {
            menu.close();
          }
        }
      }
      else {
        this.focusLastMenuItem();
      }
    }

    focusFirstMenuItem() {
      let items = this.querySelectorAll("x-menuitem:not([disabled]):not([hidden])");
      let firstItem = items[0] || null;

      if (firstItem) {
        firstItem.focus();
      }
    }

    focusLastMenuItem() {
      let items = this.querySelectorAll("x-menuitem:not([disabled]):not([hidden])");
      let lastItem = (items.length > 0) ? items[items.length-1] : null;

      if (lastItem) {
        lastItem.focus();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @doc
    //   http://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown
    _delay(callback) {
      let tolerance = 75;
      let fullDelay = 300;
      let delay = 0;

      {
        let point = this._delayPoints[this._delayPoints.length - 1];
        let prevPoint = this._delayPoints[0];
        let openedSubmenu = this.querySelector("x-menu[opened]");

        if (openedSubmenu && point) {
          if (!prevPoint) {
            prevPoint = point;
          }

          let bounds = this.getBoundingClientRect();

          let upperLeftPoint  = {x: bounds.left, y: bounds.top - tolerance };
          let upperRightPoint = {x: bounds.left + bounds.width, y: upperLeftPoint.y };
          let lowerLeftPoint  = {x: bounds.left, y: bounds.top + bounds.height + tolerance};
          let lowerRightPoint = {x: bounds.left + bounds.width, y: lowerLeftPoint.y };

          let proceed = true;

          if (
            prevPoint.x < bounds.left || prevPoint.x > lowerRightPoint.x ||
            prevPoint.y < bounds.top  || prevPoint.y > lowerRightPoint.y
          ) {
            proceed = false;
          }

          if (
            this._lastDelayPoint &&
            point.x === this._lastDelayPoint.x &&
            point.y === this._lastDelayPoint.y
          ) {
            proceed = false;
          }

          if (proceed) {
            let decreasingCorner;
            let increasingCorner;

            {
              decreasingCorner = upperRightPoint;
              increasingCorner = lowerRightPoint;
            }

            let getSlope = (a, b) => (b.y - a.y) / (b.x - a.x);
            let decreasingSlope = getSlope(point, decreasingCorner);
            let increasingSlope = getSlope(point, increasingCorner);
            let prevDecreasingSlope = getSlope(prevPoint, decreasingCorner);
            let prevIncreasingSlope = getSlope(prevPoint, increasingCorner);

            if (decreasingSlope < prevDecreasingSlope && increasingSlope > prevIncreasingSlope) {
              this._lastDelayPoint = point;
              delay = fullDelay;
            }
            else {
              this._lastDelayPoint = null;
            }
          }
        }
      }

      if (delay > 0) {
        this._delayTimeoutID = setTimeout(() => {
          this._delay(callback);
        }, delay);
      }
      else {
        callback();
      }
    }

    _clearDelay() {
      if (this._delayTimeoutID) {
        clearTimeout(this._delayTimeoutID);
        this._delayTimeoutID = null;
      }
    }

    _resetInlineStyles() {
      this.style.position = "fixed";
      this.style.top = "0px";
      this.style.left = "0px";
      this.style.width = null;
      this.style.height = null;
      this.style.minWidth = null;
      this.style.maxWidth = null;
    }

    // @info
    //   Whether this or any ancestor menu is closing
    // @type
    //   Boolean
    _isClosing() {
      return this.matches("*[closing], *[closing] x-menu");
    }

    // @info
    //   Parse the value of CSS transition property.
    // @type
    //   (string) => [string, number, string]
    _parseTransistion(string) {
      let [rawDuration, property, ...rest] = string.trim().split(" ");
      let duration = parseFloat(rawDuration);
      let easing = rest.join(" ");
      return [property, duration, easing];
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onOpenedAttributeChange() {
      this.setAttribute("aria-hidden", !this.opened);
    }

    _onPointerDown(event) {
      if (event.target === this || event.target.localName === "hr") {
        event.stopPropagation();
      }

      if (event.pointerType === "touch" && event.target.closest("x-menu") === this) {
        if (this._isPointerOverMenuBlock === false) {
          this._onMenuBlockPointerEnter();
        }

        // Focus and expand the menu item under pointer and collapse other items
        {
          let item = event.target.closest("x-menuitem");

          if (item && item.disabled === false && item.closest("x-menu") === this) {
            if (item.matches(":focus") === false) {
              this._delay( async () => {
                let otherItem = this.querySelector(":scope > x-menuitem:focus");

                if (otherItem) {
                  let otherSubmenu = otherItem.querySelector("x-menu");

                  if (otherSubmenu) {
                    // otherItem.removeAttribute("expanded");
                    otherSubmenu.close();
                  }
                }


                let menu = item.closest("x-menu");
                let submenu = item.querySelector("x-menu");
                let otherItems = [...this.querySelectorAll(":scope > x-menuitem")].filter($0 => $0 !== item);

                if (submenu) {
                  await sleep(60);

                  if (item.matches(":focus") && submenu.opened === false) {
                    submenu.openNextToElement(item, "horizontal");
                  }
                }

                for (let otherItem of otherItems) {
                  let otherSubmenu = otherItem.querySelector("x-menu");

                  if (otherSubmenu) {
                    otherSubmenu.close();
                  }
                }
              });
            }
          }
          else {
            this._delay(() => {
              this.focus();
            });
          }
        }
      }
    }

    _onPointerOver(event) {
      if (this._isClosing() || event.pointerType === "touch") {
        return;
      }

      if (event.target.closest("x-menu") === this) {
        if (this._isPointerOverMenuBlock === false) {
          this._onMenuBlockPointerEnter();
        }

        // Focus and expand the menu item under pointer and collapse other items
        {
          let item = event.target.closest("x-menuitem");

          if (item && item.disabled === false && item.closest("x-menu") === this) {
            if (item.matches(":focus") === false) {
              this._delay( async () => {
                let otherItem = this.querySelector(":scope > x-menuitem:focus");

                if (otherItem) {
                  let otherSubmenu = otherItem.querySelector("x-menu");

                  if (otherSubmenu) {
                    // otherItem.removeAttribute("expanded");
                    otherSubmenu.close();
                  }
                }

                item.focus();

                let menu = item.closest("x-menu");
                let submenu = item.querySelector("x-menu");
                let otherItems = [...this.querySelectorAll(":scope > x-menuitem")].filter($0 => $0 !== item);

                if (submenu) {
                  await sleep(60);

                  if (item.matches(":focus") && submenu.opened === false) {
                    submenu.openNextToElement(item, "horizontal");
                  }
                }

                for (let otherItem of otherItems) {
                  let otherSubmenu = otherItem.querySelector("x-menu");

                  if (otherSubmenu) {
                    otherSubmenu.close();
                  }
                }
              });
            }
          }
          else {
            this._delay(() => {
              this.focus();
            });
          }
        }
      }
    }

    _onPointerOut(event) {
      // @bug: event.relatedTarget leaks shadowDOM, so we have to use closest() utility function
      if (!event.relatedTarget || closest(event.relatedTarget, "x-menu") !== this) {
        if (this._isPointerOverMenuBlock === true) {
          this._onMenuBlockPointerLeave();
        }
      }
    }

    _onMenuBlockPointerEnter() {
      if (this._isClosing()) {
        return;
      }

      this._isPointerOverMenuBlock = true;
      this._clearDelay();
    }

    _onMenuBlockPointerLeave() {
      if (this._isClosing()) {
        return;
      }

      this._isPointerOverMenuBlock = false;
      this._clearDelay();
      this.focus();
    }

    _onPointerMove(event) {
      this._delayPoints.push({
        x: event.clientX,
        y: event.clientY
      });

      if (this._delayPoints.length > 3) {
        this._delayPoints.shift();
      }
    }

    _onWheel(event) {
      if (event.target.closest("x-menu") === this) {
        // @bugfix: Can't rely on the default wheel event behavior as it messes up the _onScroll handler on Windows.
        // For details check https://github.com/jarek-foksa/xel/issues/75
        {
          event.preventDefault();
          this.scrollTop = this.scrollTop + event.deltaY;
        }

        this._isPointerOverMenuBlock = true;
      }
      else {
        this._isPointerOverMenuBlock = false;
      }
    }

    _onScroll() {
      if (this._expandWhenScrolled) {
        let delta = this.scrollTop - this._lastScrollTop;
        this._lastScrollTop = this.scrollTop;

        if (getTimeStamp() - this._openedTimestamp > 100) {
          let menuRect = this.getBoundingClientRect();

          if (delta < 0) {
            if (menuRect.bottom + abs(delta) <= window.innerHeight - windowWhitespace) {
              this.style.height = (menuRect.height + abs(delta)) + "px";
            }
            else {
              this.style.height = (window.innerHeight - (windowWhitespace*2)) + "px";
            }
          }
          else if (delta > 0) {
            if (menuRect.top - delta >= windowWhitespace) {
              this.style.top = (this._extraTop + menuRect.top - delta) + "px";
              this.style.height = (menuRect.height + delta) + "px";

              this.scrollTop = 0;
              this._lastScrollTop = 0;
            }
            else {
              this.style.top = (windowWhitespace + this._extraTop) + "px";
              this.style.height = (window.innerHeight - (windowWhitespace*2)) + "px";
            }
          }
        }
      }
    }

    _onKeyDown(event) {
      if (this._isClosing()) {
        event.preventDefault();
        event.stopPropagation();
      }

      else if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        this.focusPreviousMenuItem();
      }

      else if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        this.focusNextMenuItem();
      }

      else if (event.code === "ArrowRight" || event.code === "Enter" || event.code === "Space") {
        let focusedItem = this.querySelector("x-menuitem:focus");

        if (focusedItem) {
          let submenu = focusedItem.querySelector("x-menu");

          if (submenu) {
            event.preventDefault();
            event.stopPropagation();

            if (submenu.opened === false) {
              submenu.openNextToElement(focusedItem, "horizontal");
            }

            let submenuFirstItem = submenu.querySelector("x-menuitem:not([disabled]):not([hidden])");

            if (submenuFirstItem) {
              submenuFirstItem.focus();
            }
          }
        }
      }

      else if (event.code === "ArrowLeft") {
        let focusedItem = this.querySelector("x-menuitem:focus");

        if (focusedItem) {
          let parentMenu = focusedItem.closest("x-menu");
          let parentItem = parentMenu.closest("x-menuitem");

          if (parentItem && parentItem.closest("x-menu")) {
            event.preventDefault();
            event.stopPropagation();

            parentItem.focus();
            this.close();
          }
        }
      }
    }
  }

  customElements.define("x-menu", XMenuElement);

  let debug = false;

  let shadowTemplate$f = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        width: 100%;
        height: fit-content;
        box-sizing: border-box;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.6;
      }

      #backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        pointer-events: none;
        touch-action: none;
      }
      #backdrop[hidden] {
        display: none;
      }

      #backdrop path {
        fill: red;
        fill-rule: evenodd;
        opacity: 0;
        pointer-events: all;
      }
    </style>

    <svg id="backdrop" hidden>
      <path id="backdrop-path"></path>
    </svg>

    <slot></slot>
  </template>
`;

  class XMenuBarElement extends HTMLElement {
    static get observedAttributes() {
      return ["disabled"];
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._expanded = false;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$f.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("focusout", (event) => this._onFocusOut(event));
      this._shadowRoot.addEventListener("pointerover", (event) => this._onShadowRootPointerOver(event));
      this._shadowRoot.addEventListener("click", (event) => this._onShadowRootClick(event));
      this._shadowRoot.addEventListener("wheel", (event) => this._onShadowRootWheel(event));
      this._shadowRoot.addEventListener("keydown", (event) => this._onShadowRootKeyDown(event));
    }

    connectedCallback() {
      this.setAttribute("role", "menubar");
      this.setAttribute("aria-disabled", this.disabled);

      window.addEventListener("orientationchange", this._orientationChangeListener = () => {
        this._onOrientationChange();
      });
    }

    disconnectedCallback() {
      window.removeEventListener("orientationchange", this._orientationChangeListener);
    }

    attributeChangedCallback(name) {
      if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _expandMenubarItem(item) {
      let menu = item.querySelector(":scope > x-menu");

      if (menu && menu.opened === false) {
        item.focus();
        this._expanded = true;
        this.style.touchAction = "none";

        // Open item's menu and close other menus
        {
          menu.openNextToElement(item, "vertical");

          let menus = this.querySelectorAll(":scope > x-menuitem > x-menu");
          let otherMenus = [...menus].filter($0 => $0 !== menu);

          for (let otherMenu of otherMenus) {
            if (otherMenu) {
              otherMenu.close(false);
            }
          }
        }

        // Show the backdrop
        {
          let {x, y, width, height} = this.getBoundingClientRect();

          this["#backdrop-path"].setAttribute("d", `
          M 0 0
          L ${window.innerWidth} 0
          L ${window.innerWidth} ${window.innerHeight}
          L 0 ${window.innerHeight}
          L 0 0
          M ${x} ${y}
          L ${x + width} ${y}
          L ${x + width} ${y + height}
          L ${x} ${y + height}
        `);

          this["#backdrop"].removeAttribute("hidden");
        }
      }
    }

    _collapseMenubarItems() {
      return new Promise( async (resolve) => {
        this._expanded = false;
        this.style.touchAction = null;

        // Hide the backdrop
        {
          this["#backdrop"].setAttribute("hidden", "");
          this["#backdrop-path"].setAttribute("d", "");
        }

        // Close all opened menus
        {
          let menus = this.querySelectorAll(":scope > x-menuitem > x-menu[opened]");

          for (let menu of menus) {
            await menu.close(true);
          }
        }

        let focusedMenuItem = this.querySelector("x-menuitem:focus");

        if (focusedMenuItem) {
          focusedMenuItem.blur();
        }

        resolve();
      });
    }

    _expandPreviousMenubarItem() {
      let items = [...this.querySelectorAll(":scope > x-menuitem:not([disabled])")];
      let focusedItem = this.querySelector(":focus").closest("x-menubar > x-menuitem");

      if (items.length > 1 && focusedItem) {
        let i = items.indexOf(focusedItem);
        let previousItem = items[i - 1] || items[items.length-1];
        this._expandMenubarItem(previousItem);
      }
    }

    _expandNextMenubarItem() {
      let items = [...this.querySelectorAll(":scope > x-menuitem:not([disabled])")];
      let focusedItem = this.querySelector(":focus").closest("x-menubar > x-menuitem");

      if (focusedItem && items.length > 1) {
        let i = items.indexOf(focusedItem);
        let nextItem = items[i + 1] || items[0];
        this._expandMenubarItem(nextItem);
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onDisabledAttributeChange() {
      this.setAttribute("aria-disabled", this.disabled);
    }

    _onFocusOut(event) {
      if ((event.relatedTarget === null || this.contains(event.relatedTarget) === false) && debug === false) {
        this._collapseMenubarItems();
      }
    }

    _onOrientationChange() {
      this._collapseMenubarItems();
    }

    _onShadowRootWheel(event) {
      let openedMenu = this.querySelector("x-menu[opened]");

      if (openedMenu && openedMenu.contains(event.target) === false) {
        event.preventDefault();
      }
    }

    async _onShadowRootClick(event) {
      if (this.hasAttribute("closing")) {
        return;
      }

      let item = event.target.closest("x-menuitem");
      let ownerMenu = event.target.closest("x-menu");

      if (item && item.disabled === false && (!ownerMenu || ownerMenu.contains(item))) {
        let menu = item.querySelector("x-menu");

        if (item.parentElement === this) {
          if (menu) {
            menu.opened ? this._collapseMenubarItems() : this._expandMenubarItem(item);
          }
        }
        else {
          if (menu) {
            if (menu.opened && menu.opened === false) {
              menu.openNextToElement(item, "horizontal");
            }
          }
          else {
            this.setAttribute("closing", "");

            await item.whenTriggerEnd;
            await this._collapseMenubarItems();

            this.removeAttribute("closing");
          }
        }
      }

      else if (event.target === this["#backdrop-path"]) {
        this._collapseMenubarItems();
        event.preventDefault();
        event.stopPropagation();
      }
    }

    _onShadowRootPointerOver(event) {
      if (this.hasAttribute("closing")) {
        return;
      }

      let item = event.target.closest("x-menuitem");

      if (event.target.closest("x-menu") === null && item && item.parentElement === this) {
        if (this._expanded && event.pointerType !== "touch") {
          if (item.hasAttribute("expanded") === false) {
            this._expandMenubarItem(item);
          }
          else {
            item.focus();
          }
        }
      }
    }

    _onShadowRootKeyDown(event) {
      if (this.hasAttribute("closing")) {
        event.stopPropagation();
        event.preventDefault();
      }

      else if (event.code === "Enter" || event.code === "Space") {
        let focusedMenubarItem = this.querySelector(":scope > x-menuitem:focus");

        if (focusedMenubarItem) {
          event.preventDefault();
          focusedMenubarItem.click();
        }
      }

      else if (event.code === "Escape") {
        if (this._expanded) {
          event.preventDefault();
          this._collapseMenubarItems();
        }
      }

      else if (event.code === "Tab") {
        let refItem = this.querySelector(":scope > x-menuitem:focus, :scope > x-menuitem[expanded]");

        if (refItem) {
          refItem.focus();

          let menu = refItem.querySelector(":scope > x-menu");

          if (menu) {
            menu.tabIndex = -1;

            menu.close().then(() => {
              menu.tabIndex = -1;
            });
          }
        }
      }

      else if (event.code === "ArrowRight") {
        this._expandNextMenubarItem();
      }

      else if (event.code === "ArrowLeft") {
        this._expandPreviousMenubarItem();
      }

      else if (event.code === "ArrowDown") {
        let menu = this.querySelector("x-menuitem:focus > x-menu");

        if (menu) {
          event.preventDefault();
          menu.focusFirstMenuItem();
        }
      }

      else if (event.code === "ArrowUp") {
        let menu = this.querySelector("x-menuitem:focus > x-menu");

        if (menu) {
          event.preventDefault();
          menu.focusLastMenuItem();
        }
      }
    }
  }

  customElements.define("x-menubar", XMenuBarElement);

  let {max: max$5} = Math;
  let easing$4 = "cubic-bezier(0.4, 0, 0.2, 1)";
  let $oldTabIndex$5 = Symbol();

  let shadowTemplate$g = html`
  <template>
    <style>
      :host {
        display: flex;
        flex-flow: row;
        align-items: center;
        position: relative;
        box-sizing: border-box;
        cursor: default;
        user-select: none;
        --trigger-effect: ripple; /* ripple, blink, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.1;
        --checkmark-d: path("M 37.5 65 L 21 48.9 L 15.7 54.35 L 37.5 76.1 L 84.3 29.3 L 78.8 23.8 Z");
        --checkmark-width: 24px;
        --checkmark-height: 24px;
        --checkmark-margin: 0 12px 0 0;
      }
      :host([hidden]) {
        display: none;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.6;
      }
      :host(:focus) {
        outline: none;
      }
      :host-context([debug]):host(:focus) {
        outline: 2px solid red;
      }

      /**
       * Ripples
       */

      #ripples {
        position: absolute;
        z-index: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        contain: strict;
        overflow: hidden;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 200px;
        height: 200px;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        transform: none;
        transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: opacity, transform;
        pointer-events: none;
      }

      /**
       * Checkmark
       */

      #checkmark {
        color: inherit;
        display: none;
        transition: transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
        align-self: center;
        width: var(--checkmark-width);
        height: var(--checkmark-height);
        margin: var(--checkmark-margin);
        d: var(--checkmark-d);
      }
      :host([togglable]) #checkmark {
        display: flex;
        transform: scale(0);
        transform-origin: 50% 50%;
      }
      :host([toggled]) #checkmark {
        display: flex;
        transform: scale(1);
      }

      #checkmark path {
        d: inherit;
        fill: currentColor;
      }

      /**
       * "Expand" arrow icon
       */

      #arrow-icon {
        display: flex;
        width: 16px;
        height: 16px;
        transform: scale(1.1);
        align-self: center;
        margin-left: 8px;
        color: inherit;
      }
      #arrow-icon[hidden] {
        display: none;
      }
    </style>

    <div id="ripples"></div>

    <svg id="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path></path>
    </svg>

    <slot></slot>
    <x-icon id="arrow-icon" name="play-arrow" hidden></x-icon>
  </template>
`;

  // @events
  //   toggle
  class XMenuItemElement extends HTMLElement {
    static get observedAttributes() {
      return ["disabled"];
    }

    // @info
    //   Value associated with this menu item (usually the command name).
    // @type
    //   string?
    // @default
    //   null
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : null;
    }
    set value(value) {
      if (this.value !== value) {
        value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
      }
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get toggled() {
      return this.hasAttribute("toggled");
    }
    set toggled(toggled) {
      toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get togglable() {
      return this.hasAttribute("togglable");
    }
    set togglable(togglable) {
      togglable ? this.setAttribute("togglable", "") : this.removeAttribute("togglable");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    // @info
    //   Promise that is resolved when any trigger effects (such ripples or blinking) are finished.
    // @type
    //   Promise
    get whenTriggerEnd() {
      return new Promise((resolve) => {
        if (this["#ripples"].childElementCount === 0 && this._blinking === false) {
          resolve();
        }
        else {
          this._triggerEndCallbacks.push(resolve);
        }
      });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._observer = new MutationObserver(() => this._updateArrowIconVisibility());

      this._blinking = false;
      this._triggerEndCallbacks = [];

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$g.content, true));

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      this._observer.observe(this, {childList: true, attributes: false, characterData: false, subtree: false});
      this._updateArrowIconVisibility();
      this._updateAccessabilityAttributes();
    }

    disconnectedCallback() {
      this._observer.disconnect();
    }

    attributeChangedCallback(name) {
      if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateArrowIconVisibility() {
      if (this.parentElement.localName === "x-menubar") {
        this["#arrow-icon"].hidden = true;
      }
      else {
        let menu = this.querySelector("x-menu");
        this["#arrow-icon"].hidden = menu ? false : true;
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "menuitem");
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$5] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$5] > 0) ? this[$oldTabIndex$5] : 0;
        }

        delete this[$oldTabIndex$5];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    async _onPointerDown(pointerDownEvent) {
      this._wasFocused = this.matches(":focus");

      if (pointerDownEvent.buttons !== 1) {
        return false;
      }

      if (this.matches("[closing] x-menuitem")) {
        pointerDownEvent.preventDefault();
        pointerDownEvent.stopPropagation();
        return;
      }

      if (pointerDownEvent.target.closest("x-menuitem") !== this) {
        return;
      }

      // Trigger effect
      {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        if (triggerEffect === "ripple") {
          let rect = this["#ripples"].getBoundingClientRect();
          let size = max$5(rect.width, rect.height) * 1.5;
          let top  = pointerDownEvent.clientY - rect.y - size/2;
          let left = pointerDownEvent.clientX - rect.x - size/2;
          let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple pointer-down-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
          this["#ripples"].append(ripple);

          this.setPointerCapture(pointerDownEvent.pointerId);

          let inAnimation = ripple.animate(
            { transform: ["scale3d(0, 0, 0)", "none"]},
            { duration: 300, easing: easing$4 }
          );

          await whenLostPointerCapture;
          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"]},
            { duration: 300, easing: easing$4 }
          );

          await outAnimation.finished;
          ripple.remove();

          if (this["#ripples"].childElementCount === 0) {
            for (let callback of this._triggerEndCallbacks) {
              callback();
            }
          }
        }
      }
    }

    async _onClick(event) {
      if (
        event.button > 0 ||
        event.target.closest("x-menuitem") !== this ||
        event.target.closest("x-menu") !== this.closest("x-menu") ||
        this.matches("[closing] x-menuitem")
      ) {
        return;
      }

      if (this.togglable) {
        let event = new CustomEvent("toggle", {bubbles: true, cancelable: true});
        this.dispatchEvent(event);

        if (event.defaultPrevented === false) {
          this.toggled = !this.toggled;
        }
      }

      // Trigger effect
      if (!this.querySelector(":scope > x-menu")) {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        if (triggerEffect === "ripple") {
          if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
            let rect = this["#ripples"].getBoundingClientRect();
            let size = max$5(rect.width, rect.height) * 1.5;
            let top  = (rect.y + rect.height/2) - rect.y - size/2;
            let left = (rect.x + rect.width/2) - rect.x - size/2;

            let ripple = createElement("div");
            ripple.setAttribute("class", "ripple click-ripple");
            ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
            this["#ripples"].append(ripple);

            let inAnimation = ripple.animate(
              { transform: ["scale3d(0, 0, 0)", "none"]},
              { duration: 300, easing: easing$4 }
            );

            await inAnimation.finished;

            let outAnimation = ripple.animate(
              { opacity: [getComputedStyle(ripple).opacity, "0"] },
              { duration: 300, easing: easing$4 }
            );

            await outAnimation.finished;

            ripple.remove();

            if (this["#ripples"].childElementCount === 0) {
              for (let callback of this._triggerEndCallbacks) {
                callback();
              }
            }
          }
        }

        else if (triggerEffect === "blink") {
          this._blinking = true;

          if (this._wasFocused) {
            this.parentElement.focus();
            await sleep(150);
            this.focus();
            await sleep(150);
          }
          else {
            this.focus();
            await sleep(150);
            this.parentElement.focus();
            await sleep(150);
          }

          this._blinking = true;

          for (let callback of this._triggerEndCallbacks) {
            callback();
          }
        }
      }
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();

        if (!this.querySelector("x-menu")) {
          event.stopPropagation();
          this.click();
        }
      }
    }
  }

  customElements.define("x-menuitem", XMenuItemElement);

  let shadowTemplate$h = html`
  <template>
    <style>
      :host {
        display: none;
        position: fixed;
        min-width: 15px;
        min-height: 15px;
        bottom: 15px;
        left: 50%;
        transform: translateX(-50%);
        padding: 5px 12px;
        box-sizing: border-box;
        color: rgba(255, 255, 255, 0.9);
        background: #434343;
        z-index: 9999;
        font-size: 12px;
        user-select: text;
        transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host([opened]),
      :host([animating]) {
        display: block;
      }
      :host(:focus) {
        outline: none;
      }
    </style>

    <slot></slot>
  </template>
`;

  class XNotificationElement extends HTMLElement {
    static get observedAttributes() {
      return ["opened"];
    }

    // @type
    //   boolean
    // @default
    //   false
    get opened() {
      return this.hasAttribute("opened");
    }
    set opened(opened) {
      opened === true ? this.setAttribute("opened", "") : this.removeAttribute("opened");
      this._time = 0;
    }

    // @info
    //   Time (in miliseconds) after which this notification should disappear.
    //   Set to 0 to disable the timeout.
    // @type
    //   number
    // @default
    //   0
    get timeout() {
      return this.hasAttribute("timeout") ? parseFloat(this.getAttribute("timeout")) : 0;
    }
    set timeout(timeout) {
      this.setAttribute("timeout", timeout);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._time = 0;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$h.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      this.setAttribute("tabindex", "0");
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "opened") {
        this.opened ? this._onOpen() : this._onClose();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onOpen() {
      // Animate in
      if (this.isConnected) {
        let fromBottom = (0 - this.getBoundingClientRect().height - 10) + "px";
        let toBottom = getComputedStyle(this).bottom;

        let inAnimation = this.animate(
          { bottom: [fromBottom, toBottom]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );
      }

      // Automatically close the notification after given timeout
      {
        this._time = 0;

        this._intervalID = setInterval(() => {
          this._time += 100;

          if (this.timeout > 0 && this._time > this.timeout) {
            this.opened = false;
          }
        }, 100);

        let openTimeStamp = getTimeStamp();

        window.addEventListener("pointerdown", this._windowPointerDownListener = (event) => {
          let pointerDownTimeStamp = getTimeStamp();
          let bounds = this.getBoundingClientRect();

          if (
            pointerDownTimeStamp - openTimeStamp > 10 &&
            rectContainsPoint(bounds, new DOMPoint(event.clientX, event.clientY)) === false
          ) {
            this.opened = false;
          }
        }, true);
      }
    }

    async _onClose() {
      clearInterval(this._intervalID);

      // Animate out
      if (this.isConnected) {
        this.setAttribute("animating", "");
        let fromBottom = getComputedStyle(this).bottom;
        let toBottom = (0 - this.getBoundingClientRect().height - 10) + "px";

        let inAnimation = this.animate(
          { bottom: [fromBottom, toBottom]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await inAnimation.finished;
        this.removeAttribute("animating");
      }

      window.removeEventListener("pointerdown", this._windowPointerDownListener, true);
    }
  }

  customElements.define("x-notification", XNotificationElement);

  // @copyright
  //   © 2016-2017 Jarosław Foksa

  let {isFinite: isFinite$1, isNaN, parseFloat: parseFloat$2} = Number;

  // @info
  //   Convert the first letter in the given string from lowercase to uppercase.
  // @type
  //   (string) => void
  let capitalize = (string) => {
    return string.charAt(0).toUpperCase() + string.substr(1);
  };

  // @info
  //   Replace every occurance of string A with string B.
  // @type
  //   (string, string, string) => string
  let replaceAll = (text, a, b) => {
    return text.split(a).join(b);
  };

  // @info
  //   Check if given string is a whitespace string as defined by DOM spec.
  // @type
  //   (string) => boolean
  // @src
  //   https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Whitespace_in_the_DOM
  let isDOMWhitespace = (string) => {
    return !(/[^\t\n\r ]/.test(string));
  };

  // @info
  //   Returns true if the passed argument is either a number or a string that represents a number.
  // @type
  //   (any) => boolean
  let isNumeric = (value) => {
    let number = parseFloat$2(value);
    return isNaN(number) === false && isFinite$1(number);
  };

  let {isFinite: isFinite$2} = Number;
  let numericKeys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "+", ",", "."];
  let $oldTabIndex$6 = Symbol();

  let shadowTemplate$i = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        width: 100px;
        height: 24px;
        box-sizing: border-box;
        color: #000000;
        --selection-color: currentColor;
        --selection-background: #B2D7FD;
        --inner-padding: 0;
      }
      :host(:hover) {
        cursor: text;
      }
      :host([error]) {
        --selection-color: white;
        --selection-background: #d50000;
      }
      :host([mixed]) {
        color: rgba(0, 0, 0, 0.7);
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      ::selection {
        color: var(--selection-color);
        background: var(--selection-background);
      }

      #main {
        display: flex;
        align-items: center;
        height: 100%;
      }

      #editor-container {
        display: flex;
        align-items: center;
        width: 100%;
        height: 100%;
        padding: var(--inner-padding);
        box-sizing: border-box;
        overflow: hidden;
      }

      #editor {
        width: 100%;
        overflow: auto;
        color: inherit;
        background: none;
        border: none;
        outline: none;
        font-family: inherit;
        font-size: inherit;
        line-height: 10;
        white-space: nowrap;
      }
      #editor::-webkit-scrollbar {
        display: none;
      }
      #editor::before {
        content: attr(data-prefix);
        pointer-events: none;
      }
      #editor::after {
        content: attr(data-suffix);
        pointer-events: none;
      }
      :host([empty]) #editor::before,
      :host([empty]) #editor::after,
      :host(:focus) #editor::before,
      :host(:focus) #editor::after {
        content: "";
      }
    </style>

    <main id="main">
      <div id="editor-container">
        <div id="editor" contenteditable="plaintext-only" spellcheck="false"></div>
      </div>

      <slot></slot>
    </main>
  </template>
`;

  // @events
  //   change
  //   changestart
  //   changeend
  //   textinputmodestart
  //   textinputmodeend
  class XNumberInputElement extends HTMLElement {
    static get observedAttributes() {
      return ["value", "min", "max", "prefix", "suffix", "disabled"];
    }

    // @type
    //   number?
    // @default
    //   null
    // @attribute
    get value() {
      return this.hasAttribute("value") ? parseFloat(this.getAttribute("value")) : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @type
    //   number
    // @default
    //   -Infinity
    // @attribute
    get min() {
      return this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : -Infinity;
    }
    set min(min) {
      isFinite$2(min) ? this.setAttribute("min", min) : this.removeAttribute("min");
    }

    // @type
    //   number
    // @default
    //   Infinity
    // @attribute
    get max() {
      return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : Infinity;
    }
    set max(max) {
      isFinite$2(max) ? this.setAttribute("max", max) : this.removeAttribute("max");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @info
    //   Maximal number of digits to be shown after the dot. This setting affects only the display value.
    // @type
    //   number
    // @default
    //   20
    // @attribute
    get precision() {
      return this.hasAttribute("precision") ? parseFloat(this.getAttribute("precision")) : 20;
    }
    set precision(value) {
      this.setAttribute("precision", value);
    }

    // @info
    //   Number by which value should be incremented or decremented when up or down arrow key is pressed.
    // @type
    //   number
    // @default
    //   1
    // @attribute
    get step() {
      return this.hasAttribute("step") ? parseFloat(this.getAttribute("step")) : 1;
    }
    set step(step) {
      this.setAttribute("step", step);
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get prefix() {
      return this.hasAttribute("prefix") ? this.getAttribute("prefix") : "";
    }
    set prefix(prefix) {
      this.setAttribute("prefix", prefix);
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get suffix() {
      return this.hasAttribute("suffix") ? this.getAttribute("suffix") : "";
    }
    set suffix(suffix) {
      this.setAttribute("suffix", suffix);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get required() {
      return this.hasAttribute("required");
    }
    set required(required) {
      required ? this.setAttribute("required", "") : this.removeAttribute("required");
    }

    // @info
    //   Whether this input has "mixed" state.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    // @type
    //   string?
    // @default
    //   null
    // @attribute
    get error() {
      return this.getAttribute("error");
    }
    set error(error) {
      error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._isDragging = false;
      this._isChangeStart = false;
      this._isArrowKeyDown = false;
      this._isBackspaceKeyDown = false;
      this._isStepperButtonDown = false;

      this._maybeDispatchChangeEndEvent = debounce(this._maybeDispatchChangeEndEvent, 500, this);

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate$i.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
      this._shadowRoot.addEventListener("wheel", (event) => this._onWheel(event));
      this["#editor"].addEventListener("paste", (event) => this._onPaste(event));
      this["#editor"].addEventListener("input", (event) => this._onEditorInput(event));
      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
      this.addEventListener("keyup", (event) => this._onKeyUp(event));
      this.addEventListener("keypress", (event) => this._onKeyPress(event));
      this.addEventListener("incrementstart", (event) => this._onStepperIncrementStart(event));
      this.addEventListener("decrementstart", (event) => this._onStepperDecrementStart(event));
      this.addEventListener("focusin", (event) => this._onFocusIn(event));
      this.addEventListener("focusout", (event) => this._onFocusOut(event));
    }

    connectedCallback() {
      this._updateAccessabilityAttributes();

      this._update();
    }

    attributeChangedCallback(name) {
      if (name === "value") {
        this._onValueAttributeChange();
      }
      else if (name === "min") {
        this._onMinAttributeChange();
      }
      else if (name === "max") {
        this._onMaxAttributeChange();
      }
      else if (name === "prefix") {
        this._onPrefixAttributeChange();
      }
      else if (name === "suffix") {
        this._onSuffixAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    // @info
    //   Override this method to validate the input value manually.
    // @type
    //   () => void
    validate() {
      if (this.value < this.min) {
        this.error = "Value is too low";
      }
      else if (this.value > this.max) {
        this.error = "Value is too high";
      }
      else if (this.required && this.value === null) {
        this.error = "This field is required";
      }
      else {
        this.error = null;
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _increment(large = false) {
      let oldValue = this.value;
      let newValue = this.value;

      if (large) {
        newValue += this.step * 10;
      }
      else {
        newValue += this.step;
      }

      newValue = normalize(newValue, this.min, this.max, getPrecision(this.step));

      if (oldValue !== newValue) {
        this.value = newValue;
      }

      if (this.matches(":focus")) {
        document.execCommand("selectAll");
      }

      this.validate();
      this._updateEmptyState();
    }

    _decrement(large = false) {
      let oldValue = this.value;
      let newValue = this.value;

      if (large) {
        newValue -= this.step * 10;
      }
      else {
        newValue -= this.step;
      }

      newValue = normalize(newValue, this.min, this.max, getPrecision(this.step));

      if (oldValue !== newValue) {
        this.value = newValue;
      }

      if (this.matches(":focus")) {
        document.execCommand("selectAll");
      }

      this.validate();
      this._updateEmptyState();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _maybeDispatchChangeStartEvent() {
      if (!this._isChangeStart) {
        this._isChangeStart = true;
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
      }
    }

    _maybeDispatchChangeEndEvent() {
      if (this._isChangeStart && !this._isArrowKeyDown && !this._isBackspaceKeyDown && !this._isStepperButtonDown) {
        this._isChangeStart = false;
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
    }

    _commitEditorChanges() {
      let editorValue = this["#editor"].textContent.trim() === "" ? null : parseFloat(this["#editor"].textContent);
      let normalizedEditorValue = normalize(editorValue, this.min, this.max);

      if (normalizedEditorValue !== this.value) {
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
        this.value = normalizedEditorValue;
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
      else if (editorValue !== this.value) {
        this.value = normalizedEditorValue;
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      this.validate();

      this._updateEditorTextContent();
      this._updateEmptyState();
      this._updateStepper();
    }

    _updateEditorTextContent() {
      if (this.hasAttribute("value")) {
        this["#editor"].textContent = this.getAttribute("value").trim();
      }
      else {
        this["#editor"].textContent = "";
      }
    }

    _updateEmptyState() {
      let value = null;

      if (this.matches(":focus")) {
        value = this["#editor"].textContent.trim() === "" ? null : parseFloat(this["#editor"].textContent);
      }
      else {
        value = this.value;
      }

      if (value === null) {
        this.setAttribute("empty", "");
      }
      else {
        this.removeAttribute("empty");
      }
    }

    _updateStepper() {
      let stepper = this.querySelector("x-stepper");

      if (stepper) {
        let canDecrement = (this.value > this.min);
        let canIncrement = (this.value < this.max);

        if (canIncrement === true && canDecrement === true) {
          stepper.removeAttribute("disabled");
        }
        else if (canIncrement === false && canDecrement === false) {
          stepper.setAttribute("disabled", "");
        }
        else if (canIncrement === false) {
          stepper.setAttribute("disabled", "increment");
        }
        else if (canDecrement === false) {
          stepper.setAttribute("disabled", "decrement");
        }
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "input");
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$6] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$6] > 0) ? this[$oldTabIndex$6] : 0;
        }

        delete this[$oldTabIndex$6];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      this._update();
    }

    _onMinAttributeChange() {
      this._updateStepper();
    }

    _onMaxAttributeChange() {
      this._updateStepper();
    }

    _onPrefixAttributeChange() {
      this["#editor"].setAttribute("data-prefix", this.prefix);
    }

    _onSuffixAttributeChange() {
      this["#editor"].setAttribute("data-suffix", this.suffix);
    }

    _onDisabledAttributeChange() {
      this["#editor"].disabled = this.disabled;
      this._updateAccessabilityAttributes();
    }

    _onFocusIn() {
      document.execCommand("selectAll");
      this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
    }

    _onFocusOut() {
      this._shadowRoot.getSelection().collapse(this["#main"]);
      this["#editor"].scrollLeft = 0;

      this._commitEditorChanges();
      this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    }

    _onEditorInput() {
      this.validate();
      this._updateEmptyState();
      this._updateStepper();
    }

    _onWheel(event) {
      if (this.matches(":focus")) {
        event.preventDefault();
        this._maybeDispatchChangeStartEvent();

        if (event.wheelDeltaX > 0 || event.wheelDeltaY > 0) {
          this._increment(event.shiftKey);
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
        else {
          this._decrement(event.shiftKey);
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }

        this._maybeDispatchChangeEndEvent();
      }
    }

    _onClick(event) {
      event.preventDefault();
    }

    _onPointerDown(pointerDownEvent) {
      if (pointerDownEvent.target.localName === "x-stepper") {
        // Don't focus the input when user clicks stepper
        pointerDownEvent.preventDefault();
      }
    }

    _onShadowRootPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1 || pointerDownEvent.isPrimary === false) {
        pointerDownEvent.preventDefault();
        return;
      }

      if (pointerDownEvent.target === this["#editor"]) {
        if (this["#editor"].matches(":focus") === false) {
          pointerDownEvent.preventDefault();

          let initialValue = this.value;
          let cachedClientX = pointerDownEvent.clientX;
          let pointerDownPoint = new DOMPoint(pointerDownEvent.clientX, pointerDownEvent.clientY);
          let pointerMoveListener, lostPointerCaptureListener;

          this.style.cursor = "col-resize";
          this["#editor"].setPointerCapture(pointerDownEvent.pointerId);

          this["#editor"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
            let pointerMovePoint = new DOMPoint(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
            let deltaTime = pointerMoveEvent.timeStamp - pointerDownEvent.timeStamp;
            let isDistinct = pointerMoveEvent.clientX !== cachedClientX;
            let isIntentional = (getDistanceBetweenPoints(pointerDownPoint, pointerMovePoint) > 3 || deltaTime > 80);
            cachedClientX = pointerMoveEvent.clientX;

            if (isDistinct && isIntentional && pointerMoveEvent.isPrimary) {
              if (this._isDragging === false) {
                this._isDragging = true;
                this._isChangeStart = true;
                this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
              }


              let dragOffset = pointerMoveEvent.clientX - pointerDownEvent.clientX;
              let value = initialValue + (dragOffset * this.step);

              value = normalize(value, this.min, this.max, getPrecision(this.step));
              this.value = value;
              this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
            }
          });

          this["#editor"].addEventListener("lostpointercapture",  lostPointerCaptureListener = () => {
            this["#editor"].removeEventListener("pointermove", pointerMoveListener);
            this["#editor"].removeEventListener("lostpointercapture", lostPointerCaptureListener);

            this.style.cursor = null;

            if (this._isDragging === true) {
              this._isDragging = false;
              this._isChangeStart = false;
              this.dispatchEvent(new CustomEvent("changeend", {detail: this.value !== initialValue, bubbles: true}));
            }
            else {
              this["#editor"].focus();
              document.execCommand("selectAll");
            }
          });
        }
      }
    }

    _onStepperIncrementStart(event) {
      let incrementListener, incrementEndListener;

      this._isStepperButtonDown = true;

      this.addEventListener("increment", incrementListener = (event) => {
        this._maybeDispatchChangeStartEvent();
        this._increment(event.detail.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        this._maybeDispatchChangeEndEvent();
        this._update();
      });

      this.addEventListener("incrementend", incrementEndListener = (event) => {
        this._isStepperButtonDown = false;
        this.removeEventListener("increment", incrementListener);
        this.removeEventListener("incrementend", incrementEndListener);
      });
    }

    _onStepperDecrementStart(event) {
      let decrementListener, decrementEndListener;

      this._isStepperButtonDown = true;

      this.addEventListener("decrement", decrementListener = (event) => {
        this._maybeDispatchChangeStartEvent();
        this._decrement(event.detail.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        this._maybeDispatchChangeEndEvent();

        this._update();
      });

      this.addEventListener("decrementend", decrementEndListener = (event) => {
        this._isStepperButtonDown = false;
        this.removeEventListener("decrement", decrementListener);
        this.removeEventListener("decrementend", decrementEndListener);
      });
    }

    _onKeyDown(event) {
      if (event.code === "ArrowDown") {
        event.preventDefault();

        this._isArrowKeyDown = true;
        this._maybeDispatchChangeStartEvent();
        this._decrement(event.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        this._maybeDispatchChangeEndEvent();

        this._update();
      }

      else if (event.code === "ArrowUp") {
        event.preventDefault();

        this._isArrowKeyDown = true;
        this._maybeDispatchChangeStartEvent();
        this._increment(event.shiftKey);
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        this._maybeDispatchChangeEndEvent();

        this._update();
      }

      else if (event.code === "Backspace") {
        this._isBackspaceKeyDown = true;
      }

      else if (event.code === "Enter") {
        this._commitEditorChanges();
        document.execCommand("selectAll");
      }
    }

    _onKeyUp(event) {
      if (event.code === "ArrowDown") {
        this._isArrowKeyDown = false;
        this._maybeDispatchChangeEndEvent();
      }

      else if (event.code === "ArrowUp") {
        this._isArrowKeyDown = false;
        this._maybeDispatchChangeEndEvent();
      }

      else if (event.code === "Backspace") {
        this._isBackspaceKeyDown = false;
      }
    }

    _onKeyPress(event) {
      if (numericKeys.includes(event.key) === false) {
        event.preventDefault();
      }
    }

    async _onPaste(event) {
      // Allow only for pasting numeric text
      event.preventDefault();
      let content = event.clipboardData.getData("text/plain").trim();

      if (isNumeric(content)) {
        // @bugfix: https://github.com/nwjs/nw.js/issues/3403
        await sleep(1);

        document.execCommand("insertText", false, content);
      }
    }
  }

  customElements.define("x-numberinput", XNumberInputElement);

  let shadowTemplate$j = html`
  <template>
    <style>
      :host {
        position: fixed;
        display: none;
        top: 0;
        left: 0;
        min-height: 30px;
        z-index: 1001;
        box-sizing: border-box;
        background: white;
        -webkit-app-region: no-drag;
        --align: bottom;
        --arrow-size: 20px;
        --open-transition: 900 transform cubic-bezier(0.4, 0, 0.2, 1);
        --close-transition: 200 opacity cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host(:focus) {
        outline: none;
      }
      :host([opened]),
      :host([animating]) {
        display: flex;
      }

      #arrow {
        position: fixed;
        box-sizing: border-box;
        content: "";
      }
      #arrow[data-align="top"],
      #arrow[data-align="bottom"] {
        width: var(--arrow-size);
        height: calc(var(--arrow-size) * 0.6);
        transform: translate(-50%, 0);
      }
      #arrow[data-align="left"],
      #arrow[data-align="right"] {
        width: calc(var(--arrow-size) * 0.6);
        height: var(--arrow-size);
        transform: translate(0, -50%);
      }

      #arrow path {
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      #arrow[data-align="bottom"] path {
        d: path("M 0 100, L 50 0, L 100 100");
      }
      #arrow[data-align="top"] path {
        d: path("M 0 0, L 50 100, L 100 0");
      }
      #arrow[data-align="left"] path {
        d: path("M 0 0, L 100 50, L 00 100");
      }
      #arrow[data-align="right"] path {
        d: path("M 100 0, L 0 50, L 100 100");
      }
    </style>

    <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path id="arrow-path"></path>
    </svg>

    <slot></slot>
  </template>
`;

  // @events
  //   open
  //   close
  class XPopoverElement extends HTMLElement {
    static get observedAttributes() {
      return ["modal"];
    }

    // @type
    //   boolean
    // @readonly
    // @attribute
    get opened() {
      return this.hasAttribute("opened");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get modal() {
      return this.hasAttribute("modal");
    }
    set modal(modal) {
      modal ? this.setAttribute("modal", "") : this.removeAttribute("modal");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$j.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#backdrop"] = createElement("x-backdrop");
      this["#backdrop"].style.background =  "rgba(0, 0, 0, 0)";
      this["#backdrop"].ownerElement = this;

      this["#backdrop"].addEventListener("click", (event) => {
        // Don't close a <dialog> when user clicks <x-popover> backdrop inside it.
        event.preventDefault();
      });

      this["#backdrop"].addEventListener("pointerdown", (event) => {
        // Catch all pointer events while the popover is opening or closing
        if (this.hasAttribute("animating")) {
          event.stopPropagation();
        }
      });
    }

    connectedCallback() {
      this.tabIndex = -1;
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "modal") {
        if (this.modal && this.opened) {
          this["#backdrop"].show();
        }
        else {
          this["#backdrop"].hide();
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Open the popover next to the given point, rect or element.
    //   Returns a promise that is resolved when the popover finishes animating.
    // @type
    //  (DOMPoint || DOMRect || Element) => void
    open(context, animate = true) {
      return new Promise( async (resolve) => {
        if (this.opened === false) {
          if (this.modal) {
            this["#backdrop"].show(false);
          }

          this.setAttribute("opened", "");
          this._updateStyle();
          this._updatePosition(context);

          document.body.addEventListener("scroll", this._scrollListener = () => {
            this._updatePosition(context);
          });

          if (animate) {
            let transition = getComputedStyle(this).getPropertyValue("--open-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            if (property === "transform") {
              await this.animate(
                {
                  transform: ["scale(1, 0)", "scale(1, 1)"],
                  transformOrigin: ["0 0", "0 0"]
                },
                { duration, easing }
              ).finished;
            }
          }

          this.dispatchEvent(new CustomEvent("open", {bubbles: true, detail: this}));
        }

        resolve();
      });
    }

    // @info
    //   Close the popover.
    //   Returns a promise that is resolved when the popover finishes animating.
    // @type
    //   (boolean) => Promise
    close(animate = true) {
      return new Promise(async (resolve) => {
        if (this.opened === true) {
          this.removeAttribute("opened");
          this["#backdrop"].hide();
          this.dispatchEvent(new CustomEvent("close", {bubbles: true, detail: this}));
          document.body.removeEventListener("scroll", this._scrollListener);

          if (animate) {
            let transition = getComputedStyle(this).getPropertyValue("--close-transition");
            let [property, duration, easing] = this._parseTransistion(transition);

            this.setAttribute("animating", "");

            if (property === "opacity") {
              await this.animate({ opacity: ["1", "0"] }, { duration, easing }).finished;
            }

            this.removeAttribute("animating");
          }
        }

        resolve();
      });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updatePosition(context) {
      let align = getComputedStyle(this).getPropertyValue("--align").trim();
      let borderWidth = parseInt(getComputedStyle(this).borderWidth);

      let windowWhitespace = 8; // Minimal whitespace between popover and window bounds
      let arrowWhitespace = 2;  // Minimal whitespace between popover and arrow

      let extraLeft = 0; // Extra offset needed when popover has fixed-positioned ancestor(s)
      let extraTop = 0;  // Extra offset needed when popover has fixed-positioned ancestor(s)
      let contextRect = null; // Rect relative to which the popover should be positioned

      this.style.maxWidth = null;
      this.style.maxHeight = null;
      this.style.left = "0px";
      this.style.top = "0px";

      // Determine extraLeft, extraTop and contextRect
      {
        let popoverRect = roundRect(this.getBoundingClientRect());

        if (popoverRect.top !== 0 || popoverRect.left !== 0) {
          extraLeft = -popoverRect.left;
          extraTop = -popoverRect.top;
        }

        if (context instanceof DOMPoint) {
          contextRect = new DOMRect(context.x, context.y, 0, 0);
        }
        else if (context instanceof DOMRect) {
          contextRect = context;
        }
        else if (context instanceof Element) {
          contextRect = context.getBoundingClientRect();
        }
        else {
          contextRect = new DOMRect();
        }
      }

      // Position the popover
      {
        if (align === "bottom" || align === "top") {
          let positionBottom = (reduceHeight = false) => {
            this.style.maxHeight = null;
            this["#arrow"].setAttribute("data-align", "bottom");

            let popoverRect = roundRect(this.getBoundingClientRect());
            let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
            let bottomOverflow = 0;

            this["#arrow"].style.top = (extraTop + contextRect.bottom + arrowWhitespace + borderWidth) + "px";
            this.style.top = (extraTop + contextRect.bottom + arrowWhitespace + arrowRect.height) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            bottomOverflow = (popoverRect.bottom + windowWhitespace) - window.innerHeight;

            if (reduceHeight && bottomOverflow > 0) {
              let maxHeight = (popoverRect.height - bottomOverflow);
              bottomOverflow = 0;

              this.style.maxHeight = maxHeight + "px";
            }

            return bottomOverflow;
          };

          let positionTop = (reduceHeight = false) => {
            this.style.maxHeight = null;
            this["#arrow"].setAttribute("data-align", "top");

            let popoverRect = roundRect(this.getBoundingClientRect());
            let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
            let topOverflow = 0;

            this["#arrow"].style.top = (extraTop + contextRect.top - arrowWhitespace - borderWidth - arrowRect.height) + "px";
            this.style.top = (extraTop + contextRect.top - arrowWhitespace - arrowRect.height - popoverRect.height) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            topOverflow = -(popoverRect.top - windowWhitespace);

            if (reduceHeight && topOverflow > 0) {
              let maxHeight = popoverRect.height - topOverflow;
              topOverflow = 0;

              this.style.maxHeight = maxHeight + "px";
              this.style.top = (extraTop + contextRect.top - arrowWhitespace - arrowRect.height - maxHeight) + "px";
            }

            return topOverflow;
          };

          let floatCenter = () => {
            this.style.maxWidth = null;

            let popoverRect = roundRect(this.getBoundingClientRect());
            let leftOverflow = 0;
            let rightOverflow = 0;

            this["#arrow"].style.left = (extraLeft + contextRect.left + contextRect.width/2) + "px";
            this.style.left = (extraLeft + contextRect.left + contextRect.width/2 - popoverRect.width/2) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            leftOverflow = -(popoverRect.left - windowWhitespace);
            rightOverflow = popoverRect.right + windowWhitespace - window.innerWidth;

            return [leftOverflow, rightOverflow];
          };

          let floatRight = (reduceWidth = false) => {
            this.style.maxWidth = null;

            let popoverRect = roundRect(this.getBoundingClientRect());
            let leftOverflow = 0;

            this["#arrow"].style.left = (extraLeft + contextRect.left + contextRect.width/2) + "px";
            this.style.left = (extraLeft + window.innerWidth - windowWhitespace - popoverRect.width) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            leftOverflow = -(popoverRect.left - windowWhitespace);

            if (reduceWidth && leftOverflow > 0) {
              let maxWidth = popoverRect.width - leftOverflow;
              leftOverflow = 0;

              this.style.maxWidth = maxWidth + "px";
              this.style.left = (extraLeft + window.innerWidth - windowWhitespace - maxWidth) + "px";
            }

            return leftOverflow;
          };

          let floatLeft = (reduceWidth = false) => {
            this.style.maxWidth = null;

            let popoverRect = roundRect(this.getBoundingClientRect());
            let rightOverflow = 0;

            this["#arrow"].style.left = (extraLeft + contextRect.left + contextRect.width/2) + "px";
            this.style.left = (extraLeft + windowWhitespace) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            rightOverflow = popoverRect.right + windowWhitespace - window.innerWidth;

            if (reduceWidth && rightOverflow > 0) {
              let maxWidth = popoverRect.width - rightOverflow;
              rightOverflow = 0;

              this.style.maxWidth = maxWidth + "px";
            }

            return rightOverflow;
          };

          // Vertical position
          {
            if (align === "bottom") {
              let bottomOverflow = positionBottom();

              if (bottomOverflow > 0) {
                let topOverflow = positionTop();

                if (topOverflow > 0) {
                  if (topOverflow > bottomOverflow) {
                    positionBottom(true);
                  }
                  else {
                    positionTop(true);
                  }
                }
              }
            }
            else if (align === "top") {
              let topOverflow = positionTop();

              if (topOverflow > 0) {
                let bottomOverflow = positionBottom();

                if (bottomOverflow > 0) {
                  if (bottomOverflow > topOverflow) {
                    positionTop(true);
                  }
                  else {
                    positionBottom(true);
                  }
                }
              }
            }
          }

          // Horizontal position
          {
            let [leftOverflow, rightOverflow] = floatCenter();

            if (rightOverflow > 0) {
              leftOverflow = floatRight();

              if (leftOverflow > 0) {
                floatRight(true);
              }
            }
            else if (leftOverflow > 0) {
              rightOverflow = floatLeft();

              if (rightOverflow > 0) {
                floatLeft(true);
              }
            }
          }
        }

        else if (align === "right" || align === "left") {
          let positionRight = (reduceWidth = false) => {
            this.style.maxWidth = null;
            this["#arrow"].setAttribute("data-align", "right");

            let popoverRect = roundRect(this.getBoundingClientRect());
            let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
            let rightOverflow = 0;

            this["#arrow"].style.left = (extraLeft + contextRect.right + arrowWhitespace + borderWidth) + "px";
            this.style.left = (extraLeft + contextRect.right + arrowWhitespace + arrowRect.width) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            rightOverflow = (popoverRect.right + windowWhitespace) - window.innerWidth;

            if (reduceWidth && rightOverflow > 0) {
              let maxWidth = (popoverRect.width - rightOverflow);
              rightOverflow = 0;

              this.style.maxWidth = maxWidth + "px";
            }

            return rightOverflow;
          };

          let positionLeft = (reduceWidth = false) => {
            this.style.maxWidth = null;
            this["#arrow"].setAttribute("data-align", "left");

            let popoverRect = roundRect(this.getBoundingClientRect());
            let arrowRect = roundRect(this["#arrow"].getBoundingClientRect());
            let leftOverflow = 0;

            this["#arrow"].style.left = (extraLeft + contextRect.left - arrowWhitespace - borderWidth - arrowRect.width) + "px";
            this.style.left = (extraLeft + contextRect.left - arrowWhitespace - arrowRect.width - popoverRect.width) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            leftOverflow = -(popoverRect.left - windowWhitespace);

            if (reduceWidth && leftOverflow > 0) {
              let maxWidth = popoverRect.width - leftOverflow;
              leftOverflow = 0;

              this.style.maxWidth = maxWidth + "px";
              this.style.left = (extraLeft + contextRect.left - arrowWhitespace - arrowRect.width - maxWidth) + "px";
            }

            return leftOverflow;
          };

          let floatCenter = () => {
            this.style.maxHeight = null;

            let popoverRect = roundRect(this.getBoundingClientRect());
            let topOverflow = 0;
            let bottomOverflow = 0;

            this["#arrow"].style.top = (extraTop + contextRect.top + contextRect.height/2) + "px";
            this.style.top = (extraTop + contextRect.top + contextRect.height/2 - popoverRect.height/2) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            topOverflow = -(popoverRect.top - windowWhitespace);
            bottomOverflow = popoverRect.bottom + windowWhitespace - window.innerHeight;

            return [topOverflow, bottomOverflow];
          };

          let floatBottom = (reduceHeight = false) => {
            this.style.maxHeight = null;

            let popoverRect = roundRect(this.getBoundingClientRect());
            let topOverflow = 0;

            this["#arrow"].style.top = (extraTop + contextRect.top + contextRect.height/2) + "px";
            this.style.top = (extraTop + window.innerHeight - windowWhitespace - popoverRect.height) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            topOverflow = -(popoverRect.top - windowWhitespace);

            if (reduceHeight && topOverflow > 0) {
              let maxHeight = popoverRect.height - topOverflow;
              topOverflow = 0;

              this.style.maxHeight = maxHeight + "px";
              this.style.top = (extraTop + window.innerHeight - windowWhitespace - maxHeight) + "px";
            }

            return topOverflow;
          };

          let floatTop = (reduceHeight = false) => {
            this.style.maxHeight = null;

            let popoverRect = roundRect(this.getBoundingClientRect());
            let bottomOverflow = 0;

            this["#arrow"].style.top = (extraTop + contextRect.top + contextRect.height/2) + "px";
            this.style.top = (extraTop + windowWhitespace) + "px";

            popoverRect = roundRect(this.getBoundingClientRect());
            bottomOverflow = popoverRect.bottom + windowWhitespace - window.innerHeight;

            if (reduceHeight && bottomOverflow > 0) {
              let maxHeight = popoverRect.height - bottomOverflow;
              bottomOverflow = 0;

              this.style.maxHeight = maxHeight + "px";
            }

            return bottomOverflow;
          };

          // Horizontal position
          {
            if (align === "right") {
              let rightOverflow = positionRight();

              if (rightOverflow > 0) {
                let leftOverflow = positionLeft();

                if (leftOverflow > 0) {
                  if (leftOverflow > rightOverflow) {
                    positionRight(true);
                  }
                  else {
                    positionLeft(true);
                  }
                }
              }
            }
            else if (align === "left") {
              let leftOverflow = positionLeft();

              if (leftOverflow > 0) {
                let rightOverflow = positionRight();

                if (rightOverflow > 0) {
                  if (rightOverflow > leftOverflow) {
                    positionLeft(true);
                  }
                  else {
                    positionRight(true);
                  }
                }
              }
            }
          }

          // Vertical position
          {
            let [topOverflow, bottomOverflow] = floatCenter();

            if (bottomOverflow > 0) {
              topOverflow = floatBottom();

              if (topOverflow > 0) {
                floatBottom(true);
              }
            }
            else if (topOverflow > 0) {
              bottomOverflow = floatTop();

              if (bottomOverflow > 0) {
                floatTop(true);
              }
            }
          }
        }
      }
    }

    _updateStyle() {
      // Make the arrow look consistentaly with the popover
      {
        let {backgroundColor, borderColor, borderWidth} = getComputedStyle(this);

        this["#arrow-path"].style.fill = backgroundColor;
        this["#arrow-path"].style.stroke = borderColor;
        this["#arrow-path"].style.strokeWidth = borderWidth;
      }
    }

    // @info
    //   Parse the value of CSS transition property.
    // @type
    //   (string) => [string, number, string]
    _parseTransistion(string) {
      let [rawDuration, property, ...rest] = string.trim().split(" ");
      let duration = parseFloat(rawDuration);
      let easing = rest.join(" ");
      return [property, duration, easing];
    }
  }

  customElements.define("x-popover", XPopoverElement);

  let shadowTemplate$k = html`
  <template>
    <style>
      :host {
        display: block;
        box-sizing: border-box;
        height: 4px;
        width: 100%;
        position: relative;
        contain: strict;
        overflow: hidden;
        background: #acece6;
        cursor: default;
        --bar-background: #3B99FB;
        --bar-box-shadow: 0px 0px 0px 1px #3385DB;
      }
      :host([hidden]) {
        display: none;
      }

      #indeterminate-bars {
        width: 100%;
        height: 100%;
      }

      #determinate-bar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: 0%;
        height: 100%;
        background: var(--bar-background);
        box-shadow: var(--bar-box-shadow);
        transition: width 0.4s ease-in-out;
        will-change: left, right;
      }
      :host([value="-1"]) #determinate-bar {
        visibility: hidden;
      }

      #primary-indeterminate-bar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        height: 100%;
        background: var(--bar-background);
        will-change: left, right;
      }

      #secondary-indeterminate-bar {
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        height: 100%;
        background: var(--bar-background);
        will-change: left, right;
      }
    </style>

    <div id="determinate-bar"></div>

    <div id="indeterminate-bars">
      <div id="primary-indeterminate-bar"></div>
      <div id="secondary-indeterminate-bar"></div>
    </div>
  </template>
`;

  class XProgressbarElement extends HTMLElement {
    static get observedAttributes() {
      return ["value", "max", "disabled"];
    }

    // @info
    //   Current progress, in procentages.
    // @type
    //   number?
    // @default
    //   null
    // @attribute
    get value() {
      return this.hasAttribute("value") ? parseFloat(this.getAttribute("value")) : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @type
    //   number?
    // @default
    //   null
    // @attribute
    get max() {
      return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : 1;
    }
    set max(max) {
      this.setAttribute("max", max);
    }

    // @info
    //   Whether this button is disabled.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$k.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      this._update();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "value") {
        this._update();
      }
      else if (name === "disabled") {
        this._update();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      // Determinate bar
      {
        // Hide
        if (this.value === null || this.value === -1 || this.disabled) {
          this["#determinate-bar"].style.width = "0%";
        }
        // Show
        else {
          this["#determinate-bar"].style.width = ((this.value / this.max) * 100) + "%";
        }
      }

      // Indeterminate bars
      {
        // Hide
        if (this.value !== null || this.disabled) {
          if (this._indeterminateAnimations) {
            for (let animation of this._indeterminateAnimations) {
              animation.cancel();
            }

            this._indeterminateAnimations = null;
          }
        }
        // Show
        else {
          if (!this._indeterminateAnimations) {
            this._indeterminateAnimations = [
              this["#primary-indeterminate-bar"].animate(
                [
                  { left: "-35%", right: "100%", offset: 0.0 },
                  { left: "100%", right: "-90%", offset: 0.6 },
                  { left: "100%", right: "-90%", offset: 1.0 }
                ],
                {
                  duration: 2000,
                  easing: "ease-in-out",
                  iterations: Infinity
                }
              ),
              this["#secondary-indeterminate-bar"].animate(
                [
                  { left: "-100%", right: "100%", offset: 0.0 },
                  { left:  "110%", right: "-30%", offset: 0.8 },
                  { left:  "110%", right: "-30%", offset: 1.0 }
                ],
                {
                  duration: 2000,
                  delay: 1000,
                  easing: "ease-in-out",
                  iterations: Infinity
                }
              )
            ];
          }
        }
      }
    }
  }

  customElements.define("x-progressbar", XProgressbarElement);

  let $oldTabIndex$7 = Symbol();

  let shadowTemplate$l = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        border: 3px solid black;
        width: 20px;
        height: 20px;
        border-radius: 99px;
        --dot-color: black;
        --dot-transform: scale(0);
        --dot-box-shadow: none;
      }
      :host([toggled]) {
        --dot-transform: scale(0.6);
      }
      :host(:focus) {
        outline: none;
      }
      :host([disabled]) {
        opacity: 0.4;
        pointer-events: none;
      }
      :host([hidden]) {
        display: none;
      }

      #main {
        border-radius: 99px;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #dot {
        width: 100%;
        height: 100%;
        background: var(--dot-color);
        border-radius: 99px;
        box-shadow: var(--dot-box-shadow);
        transform: var(--dot-transform);
        transition: all 0.15s ease-in-out;
      }
      :host([mixed][toggled]) #dot {
        height: 33%;
        border-radius: 0;
      }
    </style>

    <main id="main">
      <div id="dot"></div>
    </main>
  </template>
`;

  // @events
  //   toggle
  class XRadioElement extends HTMLElement {
    static get observedAttributes() {
      return ["toggled", "disabled"];
    }

    // @info
    //   Values associated with this widget.
    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get toggled() {
      return this.hasAttribute("toggled");
    }
    set toggled(toggled) {
      toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$l.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      this._updateAccessabilityAttributes();
    }

    attributeChangedCallback(name) {
      if (name === "toggled") {
        this._onToggledAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "radio");
      this.setAttribute("aria-checked", this.toggled);
      this.setAttribute("aria-disabled", this.disabled);

      if (!this.closest("x-radios")) {
        if (this.disabled) {
          this[$oldTabIndex$7] = (this.tabIndex > 0 ? this.tabIndex : 0);
          this.tabIndex = -1;
        }
        else {
          if (this.tabIndex < 0) {
            this.tabIndex = (this[$oldTabIndex$7] > 0) ? this[$oldTabIndex$7] : 0;
          }

          delete this[$oldTabIndex$7];
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onToggledAttributeChange() {
      this.setAttribute("aria-checked", this.toggled);
    }

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    _onClick(event) {
      if (!this.closest("x-radios")) {
        if (this.toggled && this.mixed) {
          this.mixed = false;
        }
        else {
          this.mixed = false;
          this.toggled = !this.toggled;
        }

        this.dispatchEvent(new CustomEvent("toggle", {bubbles: true}));
      }
    }

    _onPointerDown(event) {
      // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
      if (this.matches(":focus") === false) {
        event.preventDefault();

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        this.click();
      }
    }
  }
  customElements.define("x-radio", XRadioElement);

  // @copyright
  //   © 2016-2017 Jarosław Foksa
  // @doc
  //   https://www.youtube.com/watch?v=uCIC2LNt0bk

  class XRadiosElement extends HTMLElement {
    // @type
    //   string?
    // @default
    //   null
    get value() {
      let radio = this.querySelector(`x-radio[toggled]`);
      return radio ? radio.value : null;
    }
    set value(value) {
      for (let radio of this.querySelectorAll("x-radio")) {
        radio.toggled = (radio.value === value && value !== null);
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.innerHTML = `<slot></slot>`;

      this.addEventListener("click", (event) => this._onClick(event), true);
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      this.setAttribute("role", "radiogroup");

      let radios = [...this.querySelectorAll("x-radio")].filter(radio => radio.closest("x-radios") === this);
      let defaultRadio = radios.find($0 => $0.toggled && !$0.disabled) || radios.find($0 => !$0.disabled);

      for (let radio of radios) {
        radio.setAttribute("tabindex", radio === defaultRadio ? "0 ": "-1");
        radio.setAttribute("aria-checked", radio === defaultRadio);
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onClick(event) {
      let clickedRadio = event.target.localName === "x-radio" ? event.target : null;

      if (clickedRadio && !clickedRadio.toggled && !clickedRadio.disabled && event.button === 0) {
        let radios = [...this.querySelectorAll("x-radio")];
        let otherRadios = radios.filter(radio => radio.closest("x-radios") === this && radio !== clickedRadio);

        if (clickedRadio.toggled === false || clickedRadio.mixed === true) {
          clickedRadio.toggled = true;
          clickedRadio.mixed = false;
          clickedRadio.tabIndex = 0;

          for (let radio of otherRadios) {
            radio.toggled = false;
            radio.tabIndex = -1;
          }

          this.dispatchEvent(new CustomEvent("toggle", {bubbles: true, detail: clickedRadio}));
        }
      }
    }

    _onKeyDown(event) {
      let {key} = event;

      if (key === "ArrowDown" || key === "ArrowRight") {
        let radios = [...this.querySelectorAll("x-radio")];
        let contextRadios = radios.filter($0 => $0.disabled === false && $0.closest("x-radios") === this);
        let focusedRadio = radios.find(radio => radio.matches(":focus"));

        if (focusedRadio) {
          let focusedRadioIndex = contextRadios.indexOf(focusedRadio);
          let nextRadio = contextRadios.length > 1 ? contextRadios[focusedRadioIndex+1] || contextRadios[0] : null;

          if (nextRadio) {
            event.preventDefault();

            nextRadio.focus();
            nextRadio.tabIndex = 0;
            focusedRadio.tabIndex = -1;
          }
        }
      }

      else if (key === "ArrowUp" || key === "ArrowLeft") {
        let radios = [...this.querySelectorAll("x-radio")];
        let contextRadios = radios.filter($0 => $0.disabled === false && $0.closest("x-radios") === this);
        let focusedRadio = radios.find(radio => radio.matches(":focus"));

        if (focusedRadio) {
          let focusedRadioIndex = contextRadios.indexOf(focusedRadio);
          let lastRadio = contextRadios[contextRadios.length-1];
          let prevRadio = contextRadios.length > 1 ? contextRadios[focusedRadioIndex-1] || lastRadio : null;

          if (prevRadio) {
            event.preventDefault();

            prevRadio.focus();
            prevRadio.tabIndex = 0;
            focusedRadio.tabIndex = -1;
          }
        }
      }
    }
  }

  customElements.define("x-radios", XRadiosElement);

  let shadowHTML$2 = `
  <style>
    :host {
      display: block;
      width: 100%;
      user-select: none;
    }
    :host([hidden]) {
      display: none;
    }

    /**
     * Hue slider
     */

    #hue-slider {
      width: 100%;
      height: 28px;
      padding: 0 calc(var(--marker-width) / 2);
      margin-bottom: 14px;
      box-sizing: border-box;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
      background: red;
    }

    #hue-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      background: linear-gradient(to right,
        rgba(255, 0, 0, 1),
        rgba(255, 255, 0, 1),
        rgba(0, 255, 0, 1),
        rgba(0, 255, 255, 1),
        rgba(0, 0, 255, 1),
        rgba(255, 0, 255, 1),
        rgba(255, 0, 0, 1)
      );
    }

    #hue-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }

    /**
     * Saturation-lightness slider
     */

    #satlight-slider {
      width: 100%;
      height: 174px;
      border-radius: 2px;
      position: relative;
      touch-action: pinch-zoom;
    }

    #satlight-marker {
      position: absolute;
      top: 0%;
      left: 0%;
      width: var(--marker-size);
      height: var(--marker-size);
      transform: translate(calc(var(--marker-size) / -2), calc(var(--marker-size) / -2));
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: 3px solid white;
      border-radius: 999px;
      box-shadow: 0 0 3px black;
      --marker-size: 20px;
    }

    /**
     * Alpha slider
     */

    #alpha-slider {
      position: relative;
      display: none;
      width: 100%;
      height: 28px;
      margin-top: 14px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border: 1px solid #cecece;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
      /* Checkerboard pattern */
      background-color: white;
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
      background-image: linear-gradient(45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(-45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #d6d6d6 75%),
                        linear-gradient(-45deg, transparent 75%, #d6d6d6 75%);
    }
    :host([alphaslider]) #alpha-slider {
      display: block;
    }

    #alpha-slider-gradient {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    #alpha-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #alpha-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }
  </style>

  <x-box vertical>
    <div id="hue-slider">
      <div id="hue-slider-track">
        <div id="hue-slider-marker"></div>
      </div>
    </div>

    <div id="satlight-slider">
      <div id="satlight-marker"></div>
    </div>

    <div id="alpha-slider">
      <div id="alpha-slider-gradient"></div>
      <div id="alpha-slider-track">
        <div id="alpha-slider-marker"></div>
      </div>
    </div>
  </x-box>
`;

  // @events
  //   change
  //   changestart
  //   changeend
  class XRectColorPickerElement extends HTMLElement {
    static get observedAttributes() {
      return ["value"];
    }

    // @type
    //   string
    // @default
    //   "hsla(0, 0%, 100%, 1)"
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : "hsla(0, 0%, 100%, 1)";
    }
    set value(value) {
      this.setAttribute("value", value);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      // Note that HSVA color model is used only internally
      this._h = 0;   // Hue (0 ~ 360)
      this._s = 0;   // Saturation (0 ~ 100)
      this._v = 100; // Value (0 ~ 100)
      this._a = 1;   // Alpha (0 ~ 1)

      this._isDraggingHueSliderMarker = false;
      this._isDraggingSatlightMarker = false;
      this._isDraggingAlphaSliderMarker = false;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.innerHTML = shadowHTML$2;

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#hue-slider"].addEventListener("pointerdown", (event) => this._onHueSliderPointerDown(event));
      this["#satlight-slider"].addEventListener("pointerdown", (event) => this._onSatlightSliderPointerDown(event));
      this["#alpha-slider"].addEventListener("pointerdown", (event) => this._onAlphaSliderPointerDown(event));
    }

    connectedCallback() {
      this._update();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "value") {
        this._onValueAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      this._updateHueSliderMarker();

      this._updateSatlightSliderMarker();
      this._updateSatlightSliderBackground();

      this._updateAlphaSliderMarker();
      this._updateAlphaSliderBackground();
    }

    _updateHueSliderMarker() {
      this["#hue-slider-marker"].style.left = ((normalize(this._h, 0, 360, 0) / 360) * 100) + "%";
    }

    _updateSatlightSliderMarker() {
      let left = (this._s / 100) * 100;
      let top = 100 - ((this._v / 100) * 100);

      this["#satlight-marker"].style.left = `${left}%`;
      this["#satlight-marker"].style.top = `${top}%`;
    }

    _updateSatlightSliderBackground() {
      let background1 = serializeColor([this._h, 100, 50, 1], "hsla", "hex");
      let background2 = "linear-gradient(to left, rgba(255,255,255,0), rgba(255,255,255,1))";
      let background3 = "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,1))";
      this["#satlight-slider"].style.background = `${background3}, ${background2}, ${background1}`;
    }

    _updateAlphaSliderMarker() {
      this["#alpha-slider-marker"].style.left = normalize((1 - this._a) * 100, 0, 100, 2) + "%";
    }

    _updateAlphaSliderBackground() {
      let [r, g, b] = hsvToRgb(this._h, this._s, this._v).map($0 => round($0, 0));

      this["#alpha-slider-gradient"].style.background = `
      linear-gradient(to right, rgba(${r}, ${g}, ${b}, 1), rgba(${r}, ${g}, ${b}, 0))
    `;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      if (
        this._isDraggingHueSliderMarker === false &&
        this._isDraggingSatlightMarker === false &&
        this._isDraggingAlphaSliderMarker === false
      ) {
        let [h, s, v, a] = parseColor(this.value, "hsva");

        this._h = h;
        this._s = s;
        this._v = v;
        this._a = a;

        this._update();
      }
    }

    _onSatlightSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let pointerMoveListener, lostPointerCaptureListener;
      let sliderBounds = this["#satlight-slider"].getBoundingClientRect();

      this._isDraggingSatlightMarker = true;
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
      this["#satlight-slider"].setPointerCapture(pointerDownEvent.pointerId);

      let onPointerMove = (clientX, clientY) => {
        let x = ((clientX - sliderBounds.left) / sliderBounds.width) * 100;
        let y = ((clientY - sliderBounds.top) / sliderBounds.height) * 100;

        x = normalize(x, 0, 100, 2);
        y = normalize(y, 0, 100, 2);

        this._s = x;
        this._v = 100 - y;

        this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

        this._updateSatlightSliderMarker();
        this._updateSatlightSliderBackground();
        this._updateAlphaSliderBackground();
      };

      onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

      this["#satlight-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
      });

      this["#satlight-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = (event) => {
        this["#satlight-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#satlight-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
        this._isDraggingSatlightMarker = false;
      });
    }

    _onHueSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#hue-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingHueSliderMarker = true;
      this["#hue-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let h = ((clientX - trackBounds.x) / trackBounds.width) * 360;
        h = normalize(h, 0, 360, 0);

        if (h !== this._h) {
          this._h = h;
          this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");

          this._updateHueSliderMarker();
          this._updateSatlightSliderBackground();
          this._updateSatlightSliderMarker();
          this._updateAlphaSliderBackground();

          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#hue-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#hue-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#hue-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#hue-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

        this._isDraggingHueSliderMarker = false;
      });
    }

    _onAlphaSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#alpha-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingAlphaSliderMarker = true;
      this["#alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let a = 1 - ((clientX - trackBounds.x) / trackBounds.width);
        a = normalize(a, 0, 1, 2);

        if (a !== this._a) {
          this._a = a;
          this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");
          this._updateAlphaSliderMarker();
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#alpha-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#alpha-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));

        this._isDraggingAlphaSliderMarker = false;
      });
    }
  }
  customElements.define("x-rectcolorpicker", XRectColorPickerElement);

  let windowPadding = 7;
  let $itemChild = Symbol();
  let $oldTabIndex$8 = Symbol();

  let shadowTemplate$m = html`
  <template>
    <style>
      :host {
        display: block;
        width: fit-content;
        height: fit-content;
        max-width: 100%;
        box-sizing: border-box;
        outline: none;
        font-size: 15px;
        user-select: none;
        --arrow-width: 13px;
        --arrow-height: 13px;
        --arrow-min-width: 13px;
        --arrow-margin: 0 2px 0 11px;
        --arrow-color: currentColor;
        --arrow-d: path(
          "M 25 41 L 50 16 L 75 41 L 83 34 L 50 1 L 17 34 Z M 17 66 L 50 100 L 83 66 L 75 59 L 50 84 L 25 59 Z"
        );
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }
      :host(:hover) {
        cursor: default;
      }

      #button {
        display: flex;
        flex-flow: row;
        align-items: center;
        justify-content: flex-start;
        flex: 1;
        width: 100%;
        height: 100%;
      }

      :host([mixed]) #button > * {
        opacity: 0.7;
      }

      #button > x-label {
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
      }

      #button > #arrow-container {
        margin: 0 0 0 auto;
        z-index: 999;
      }

      #button > #arrow-container #arrow {
        display: flex;
        width: var(--arrow-width);
        height: var(--arrow-height);
        min-width: var(--arrow-min-width);
        margin: var(--arrow-margin);
        color: var(--arrow-color);
        d: var(--arrow-d);
      }

      #button > #arrow-container #arrow path {
        fill: currentColor;
        d: inherit;
      }
    </style>

    <div id="button">
      <div id="arrow-container">
        <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path></path>
        </svg>
      </div>
    </div>

    <slot></slot>
  </template>
`;

  // @event
  //   change {oldValue: string?, newValue: string?}
  class XSelectElement extends HTMLElement {
    static get observedAttributes() {
      return ["disabled"];
    }

    // @type
    //   string?
    // @default
    //   null
    get value() {
      let item = this.querySelector(`x-menuitem[toggled]`);
      return item ? item.value : null;
    }
    set value(value) {
      for (let item of this.querySelectorAll("x-menuitem")) {
        item.toggled = (item.value === value && value !== null);
      }
    }

    // @info
    //   Whether this select has "mixed" state.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._wasFocusedBeforeExpanding = false;
      this._updateButtonTh300 = throttle(this._updateButton, 300, this);

      this._mutationObserver = new MutationObserver((args) => this._onMutation(args));
      this._resizeObserver = new ResizeObserver(() => this._updateButtonChildrenSize());

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$m.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#backdrop"] = createElement("x-backdrop");
      this["#backdrop"].style.opacity = "0";
      this["#backdrop"].ownerElement = this;
      this["#backdrop"].addEventListener("click", (event) => this._onBackdropClick(event));

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("toggle", (event) => this._onMenuItemToggle(event));
      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));

    }

    connectedCallback() {
      this._mutationObserver.observe(this, {childList: true, attributes: true, characterData: true, subtree: true});
      this._resizeObserver.observe(this);

      this._updateButton();
      this._updateAccessabilityAttributes();
    }

    disconnectedCallback() {
      this._mutationObserver.disconnect();
      this._resizeObserver.disconnect();
    }

    attributeChangedCallback(name) {
      if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _expand() {
      if (this._canExpand() === false) {
        return;
      }

      this._wasFocusedBeforeExpanding = this.matches(":focus");

      this["#backdrop"].show(false);

      window.addEventListener("resize", this._resizeListener = () => {
        this._collapse();
      });

      window.addEventListener("blur", this._blurListener = () => {
        {
          this._collapse();
        }
      });

      let menu = this.querySelector(":scope > x-menu");

      // Ensure all items are togglable, there is at most one toggled menu item and all other items are not toggled
      {
        let toggledItem = null;

        for (let item of menu.querySelectorAll("x-menuitem")) {
          item.togglable = true;

          if (item.toggled) {
            if (toggledItem === null) {
              toggledItem = item;
            }
            else {
              item.toggled = false;
            }
          }
        }
      }

      // Open the menu
      {
        let toggledItem = menu.querySelector(`x-menuitem[toggled]`);

        if (toggledItem) {
          let buttonChild = this["#button"].querySelector("x-label") || this["#button"].firstElementChild;
          let itemChild = buttonChild[$itemChild];

          menu.openOverElement(buttonChild, itemChild);
        }
        else {
          let item = menu.querySelector("x-menuitem").firstElementChild;
          menu.openOverElement(this["#button"], item);
        }
      }

      // Increase menu width if it is narrower than the button
      {
        let menuBounds = menu.getBoundingClientRect();
        let buttonBounds = this["#button"].getBoundingClientRect();
        let hostPaddingRight = parseFloat(getComputedStyle(this).paddingRight);

        if (menuBounds.right - hostPaddingRight < buttonBounds.right) {
          menu.style.minWidth = (buttonBounds.right - menuBounds.left + hostPaddingRight) + "px";
        }
      }

      // Reduce menu width if it oveflows the right client bound
      {
        let menuBounds = this.getBoundingClientRect();

        if (menuBounds.right + windowPadding > window.innerWidth) {
          this.style.maxWidth = (window.innerWidth - menuBounds.left - windowPadding) + "px";
        }
      }
    }

    async _collapse(whenTriggerEnd = null) {
      if (this._canCollapse() === false) {
        return;
      }

      let menu = this.querySelector(":scope > x-menu");
      menu.setAttribute("closing", "");
      await whenTriggerEnd;
      this["#backdrop"].hide(false);

      if (this._wasFocusedBeforeExpanding) {
        this.focus();
      }
      else {
        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      window.removeEventListener("resize", this._resizeListener);
      window.removeEventListener("blur", this._blurListener);

      await menu.close();
      menu.removeAttribute("closing");
    }

    _canExpand() {
      if (this.disabled) {
        return false;
      }
      else {
        let menu = this.querySelector(":scope > x-menu");
        let item = menu.querySelector("x-menuitem");
        return menu !== null && menu.opened === false && menu.hasAttribute("closing") === false && item !== null;
      }
    }

    _canCollapse() {
      if (this.disabled) {
        return false;
      }
      else {
        let menu = this.querySelector(":scope > x-menu");
        let item = menu.querySelector("x-menuitem");
        return menu !== null && menu.opened === true && menu.hasAttribute("closing") === false;
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateButton() {
      let toggledItem = this.querySelector(`:scope > x-menu x-menuitem[toggled]`);
      this["#button"].innerHTML = "";

      if (toggledItem) {
        for (let itemChild of toggledItem.children) {
          let buttonChild = itemChild.cloneNode(true);
          buttonChild[$itemChild] = itemChild;
          buttonChild.removeAttribute("id");
          buttonChild.removeAttribute("style");
          this["#button"].append(buttonChild);
        }

        this._updateButtonChildrenSize();
      }

      this["#button"].append(this["#arrow-container"]);
    }

    _updateButtonChildrenSize() {
      for (let buttonChild of this["#button"].children) {
        if (buttonChild !== this["#arrow-container"]) {
          let {width, height, margin, padding, border} = getComputedStyle(buttonChild[$itemChild]);

          if (["x-icon", "x-swatch", "img", "svg"].includes(buttonChild[$itemChild].localName)) {
            buttonChild.style.width = width;
            buttonChild.style.height = height;
            buttonChild.style.minWidth = width;
          }

          buttonChild.style.margin = margin;
          buttonChild.style.padding = padding;
          buttonChild.style.border = border;
        }
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("aria-disabled", this.disabled);

      // Update "tabindex" attribute
      {
        if (this.disabled) {
          this[$oldTabIndex$8] = (this.tabIndex > 0 ? this.tabIndex : 0);
          this.tabIndex = -1;
        }
        else {
          if (this.tabIndex < 0) {
            this.tabIndex = (this[$oldTabIndex$8] > 0) ? this[$oldTabIndex$8] : 0;
          }

          delete this[$oldTabIndex$8];
        }
      }

      // Update "role" attributes
      {
        this.setAttribute("role", "button");
        let menu = this.querySelector(":scope > x-menu");

        if (menu) {
          menu.setAttribute("role", "listbox");

          for (let item of menu.querySelectorAll("x-menuitem")) {
            item.setAttribute("role", "option");
          }
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    _onMutation(records) {
      for (let record of records) {
        if (record.type === "attributes" && record.target.localName === "x-menuitem" && record.attributeName === "toggled") {
          this._updateButtonTh300();
        }
      }
    }

    _onPointerDown(event) {
      // Don't focus the widget with pointer
      if (!event.target.closest("x-menu") && this.matches(":focus") === false) {
        event.preventDefault();
      }
    }

    _onClick(event) {
      if (event.button !== 0) {
        return;
      }

      if (this._canExpand()) {
        this._expand();
      }
      else if (this._canCollapse()) {
        let clickedItem = event.target.closest("x-menuitem");

        if (clickedItem) {
          let oldValue = this.value;
          let newValue = clickedItem.value;

          for (let item of this.querySelectorAll("x-menuitem")) {
            item.toggled = (item === clickedItem);
          }

          if (oldValue !== newValue || this.mixed) {
            this.mixed = false;
            this.dispatchEvent(new CustomEvent("change", {bubbles: true, detail: {oldValue, newValue}}));
          }

          this._collapse(clickedItem.whenTriggerEnd);
        }
      }
    }

    _onMenuItemToggle(event) {
      // We will toggle the menu items manually
      event.preventDefault();
    }

    _onBackdropClick(event) {
      this._collapse();
    }

    _onKeyDown(event) {
      if (event.defaultPrevented === false) {
        let menu = this.querySelector(":scope > x-menu");

        if (event.key === "Enter" || event.key === "Space" || event.key === "ArrowUp" || event.key === "ArrowDown") {
          if (this._canExpand()) {
            event.preventDefault();
            this._expand();
          }
        }

        else if (event.key === "Escape") {
          if (this._canCollapse()) {
            event.preventDefault();
            this._collapse();
          }
        }
      }
    }
  }

  customElements.define("x-select", XSelectElement);

  let isAppleDevice = navigator.platform.startsWith("Mac") || ["iPhone", "iPad"].includes(navigator.platform);

  // @doc
  //   https://www.w3.org/TR/uievents-key/#keys-modifier
  let modKeys = [
    "Alt",
    "AltGraph",
    "CapsLock",
    "Control",
    "Fn",
    "FnLock",
    "Meta",
    "NumLock",
    "ScrollLock",
    "Shift",
    "Symbol",
    "SymbolLock"
  ];

  let shadowTemplate$n = html`
  <template>
    <style>
      :host {
        display: inline-block;
        box-sizing: border-box;
        font-size: 14px;
        line-height: 1;
      }
      :host([hidden]) {
        display: none;
      }
    </style>

    <main id="main"></main>
  </template>
`;

  class XShortcutElement extends HTMLElement {
    static get observedAttributes() {
      return ["value"];
    }

    // @type
    //   Array<string>
    // @default
    //   []
    // @attribute
    get value() {
      let value = [];

      if (this.hasAttribute("value")) {
        let parts = this.getAttribute("value").replace("++", "+PLUS").split("+");
        parts = parts.map($0 => $0.trim().replace("PLUS", "+")).filter($0 => $0 !== "");
        value = parts;
      }

      return value;
    }
    set value(value) {
      this.setAttribute("value", value.join("+"));
    }

    // @type
    //   Array<string>
    get modKeys() {
      return this.value.filter(key => modKeys.includes(key));
    }

    // @type
    //   String?
    get normalKey() {
      let key = this.value.find(key => modKeys.includes(key) === false);
      return key === undefined ? null : key;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$n.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    attributeChangedCallback(name) {
      if (name === "value") {
        this._update();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      let displayValue = "";

      let keys = this.value;
      let modKeys = this.modKeys;
      let normalKey = this.normalKey;

      if (isAppleDevice) {
        if (modKeys.includes("Meta")) {
          displayValue += "^";
        }
        if (modKeys.includes("Alt")) {
          displayValue += "⌥";
        }
        if (modKeys.includes("Shift")) {
          displayValue += "⇧";
        }
        if (modKeys.includes("Control")) {
          displayValue += "⌘";
        }
        if (modKeys.includes("Symbol")) {
          displayValue += "☺";
        }

        let mappings = {
          "ArrowUp": "↑",
          "ArrowDown": "↓",
          "ArrowLeft": "←",
          "ArrowRight": "→",
          "Backspace": "⌦"
        };

        if (normalKey !== undefined) {
          displayValue += mappings[normalKey] || normalKey;
        }
      }
      else {
        let parts = [];

        if (modKeys.includes("Control")) {
          parts.push("Ctrl");
        }
        if (modKeys.includes("Alt")) {
          parts.push("Alt");
        }
        if (modKeys.includes("Meta")) {
          parts.push("Meta");
        }
        if (modKeys.includes("Shift")) {
          parts.push("Shift");
        }
        if (modKeys.includes("Symbol")) {
          parts.push("Symbol");
        }

        let mappings = {
          "ArrowUp": "Up",
          "ArrowDown": "Down",
          "ArrowLeft": "Left",
          "ArrowRight": "Right"
        };

        if (normalKey !== null) {
          parts.push(mappings[normalKey] || normalKey);
        }

        displayValue = parts.join("+");
      }

      this["#main"].textContent = displayValue;
    }
  }

  customElements.define("x-shortcut", XShortcutElement);

  let getClosestMultiple = (number, step) => round(round(number / step) * step, getPrecision(step));
  let $oldTabIndex$9 = Symbol();

  let shadowTemplate$o = html`
  <template>
    <style>
      :host {
        display: block;
        width: 100%;
        position: relative;
        box-sizing: border-box;
        touch-action: pan-y;
        --focus-ring-color: currentColor;
        --focus-ring-opacity: 1;
        --focus-ring-width: 10px;
        --focus-ring-transition-duration: 0.15s;
        --thumb-width: 20px;
        --thumb-height: 20px;
        --thumb-d: path("M 50 50 m -50 0 a 50 50 0 1 0 100 0 a 50 50 0 1 0 -100 0");
        --thumb-transform: none;
        --thumb-color: gray;
        --thumb-border-width: 1px;
        --thumb-border-color: rgba(0, 0, 0, 0.2);
        --tick-color: rgba(0, 0, 0, 0.4);
        --track-height: 2px;
        --track-color: gray;
        --track-tint-color: black;
      }
      :host(:focus) {
        outline: none;
      }
      :host(:hover) {
        cursor: default;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.4;
      }

      /**
       * Tracks
       */

      #tracks {
        position: absolute;
        width: 100%;
        height: var(--track-height);
        top: calc((var(--thumb-height) / 2) - var(--track-height)/2);
      }

      #tracks #normal-track {
        position: absolute;
        width: 100%;
        height: 100%;
        background: var(--track-color);
        border-radius: 10px;
      }

      #tracks #tint-track {
        position: absolute;
        width: 0%;
        height: 100%;
        background: var(--track-tint-color);
      }

      /**
       * Thumbs
       */

      #thumbs {
        position: relative;
        width: calc(100% - var(--thumb-width));
        height: 100%;
      }

      #thumbs .thumb {
        position: relative;
        left: 0;
        width: var(--thumb-width);
        height: var(--thumb-height);
        display: block;
        box-sizing: border-box;
        overflow: visible;
        transform: var(--thumb-transform);
        transition: transform 0.2s ease-in-out;
        will-change: transform;
        d: var(--thumb-d);
      }

      #thumbs .thumb .shape {
        d: inherit;
        fill: var(--thumb-color);
        stroke: var(--thumb-border-color);
        stroke-width: var(--thumb-border-width);
        vector-effect: non-scaling-stroke;
      }

      #thumbs .thumb .focus-ring {
        d: inherit;
        fill: none;
        stroke: var(--focus-ring-color);
        stroke-width: 0;
        opacity: var(--focus-ring-opacity);
        vector-effect: non-scaling-stroke;
        transition: stroke-width var(--focus-ring-transition-duration) cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host(:focus) #thumbs .thumb .focus-ring {
        stroke-width: var(--focus-ring-width);
      }

      /**
       * Ticks
       */

      #ticks {
        width: calc(100% - var(--thumb-width));
        height: 5px;
        margin: 0 0 3px 0;
        position: relative;
        margin-left: calc(var(--thumb-width) / 2);
      }
      #ticks:empty {
        display: none;
      }

      #ticks .tick {
        position: absolute;
        width: 1px;
        height: 100%;
        background: var(--tick-color);
      }

      /**
       * Labels
       */

      #labels {
        position: relative;
        width: calc(100% - var(--thumb-width));
        height: 14px;
        margin-left: calc(var(--thumb-width) / 2);
        font-size: 12px;
      }
      :host(:empty) #labels {
        display: none;
      }

      ::slotted(x-label) {
        position: absolute;
        transform: translateX(-50%);
      }
    </style>

    <div id="tracks">
      <div id="normal-track"></div>
      <div id="tint-track"></div>
    </div>

    <div id="thumbs">
      <svg id="start-thumb" class="thumb" viewBox="0 0 100 100" preserveAspectRatio="none" style="left: 0%;">
        <path class="focus-ring"></path>
        <path class="shape"></path>
      </svg>
    </div>

    <div id="ticks"></div>

    <div id="labels">
      <slot></slot>
    </div>
  </template>
`;

  // @events
  //   change
  //   changestart
  //   changeend
  class XSliderElement extends HTMLElement {
    static get observedAttributes() {
      return ["value", "min", "max"];
    }

    // @type
    //   number
    // @default
    //   0
    // @attribute
    get min() {
      return this.hasAttribute("min") ? parseFloat(this.getAttribute("min")) : 0;
    }
    set min(min) {
      this.setAttribute("min", min);
    }

    // @type
    //   number
    // @default
    //   100
    // @attribute
    get max() {
      return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : 100;
    }
    set max(max) {
      this.setAttribute("max", max);
    }

    // @type
    //   number
    // @attribute
    get value() {
      if (this.hasAttribute("value")) {
        return parseFloat(this.getAttribute("value"));
      }
      else {
        return this.max >= this.min ? this.min + (this.max - this.min) / 2 : this.min;
      }
    }
    set value(value) {
      value = normalize(value, this.min, this.max);
      this.setAttribute("value", value);
    }

    // @type
    //   number
    // @default
    //   1
    // @attribute
    get step() {
      return this.hasAttribute("step") ? parseFloat(this.getAttribute("step")) : 1;
    }
    set step(step) {
      this.setAttribute("step", step);
    }

    // @info
    //   Whether this button is disabled.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$o.content, true));

      this._observer = new MutationObserver((args) => this._onMutation(args));
      this._updateTicks500ms = throttle(this._updateTicks, 500, this);

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "value") {
        this._onValueAttributeChange();
      }
      else if (name === "min") {
        this._onMinAttributeChange();
      }
      else if (name === "max") {
        this._onMaxAttributeChange();
      }
    }

    connectedCallback() {
      this.setAttribute("value", this.value);

      this._observer.observe(this, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["value"],
        characterData: false
      });

      this._updateTracks();
      this._updateThumbs();
      this._updateTicks();
      this._updateAccessabilityAttributes();
    }

    disconnectedCallback() {
      this._observer.disconnect();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateTracks() {
      let left = (((this.value - this.min) / (this.max - this.min)) * 100);
      let originLeft = (((this.min > 0 ? this.min : 0) - this.min) / (this.max - this.min)) * 100;

      if (left >= originLeft) {
        this["#tint-track"].style.left = `${originLeft}%`;
        this["#tint-track"].style.width = (left - originLeft) + "%";
      }
      else {
        this["#tint-track"].style.left = `${left}%`;
        this["#tint-track"].style.width = `${originLeft - left}%`;
      }
    }

    _updateThumbs(animate) {
      this["#start-thumb"].style.left = (((this.value - this.min) / (this.max - this.min)) * 100) + "%";
    }

    async _updateTicks() {
      await customElements.whenDefined("x-label");

      this["#ticks"].innerHTML = "";

      for (let label of this.querySelectorAll(":scope > x-label")) {
        label.style.left = (((label.value - this.min) / (this.max - this.min)) * 100) + "%";
        this["#ticks"].insertAdjacentHTML("beforeend", `<div class="tick" style="left: ${label.style.left}"></div>`);
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$9] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$9] > 0) ? this[$oldTabIndex$9] : 0;
        }

        delete this[$oldTabIndex$9];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      this._updateTracks();
      this._updateThumbs();
    }

    _onMinAttributeChange() {
      this._updateTracks();
      this._updateThumbs();
      this._updateTicks();
    }

    _onMaxAttributeChange() {
      this._updateTracks();
      this._updateThumbs();
      this._updateTicks();
    }

    _onMutation(records) {
      for (let record of records) {
        if (record.type === "attributes" && record.target === this) {
          return;
        }
        else {
          this._updateTicks500ms();
        }
      }
    }

    _onPointerDown(event) {
      // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
      if (this.matches(":focus") === false) {
        event.preventDefault();

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }
    }

    _onShadowRootPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1 || pointerDownEvent.isPrimary === false) {
        return;
      }

      let containerBounds = this["#thumbs"].getBoundingClientRect();
      let thumb = this["#start-thumb"];
      let thumbBounds = thumb.getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;
      let changeStarted = false;

      this.setPointerCapture(pointerDownEvent.pointerId);

      let updateValue = (clientX, animate) => {
        let x = clientX - containerBounds.x - thumbBounds.width/2;
        x = normalize(x, 0, containerBounds.width);

        let value = (x / containerBounds.width) * (this.max - this.min) + this.min;
        value = getClosestMultiple(value, this.step);

        if (this.value !== value) {
          this.value = value;

          if (changeStarted === false) {
            changeStarted = true;
            this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));
          }

          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      if (pointerDownEvent.target.closest(".thumb") !== thumb) {
        updateValue(pointerDownEvent.clientX);
      }

      this.addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        if (pointerMoveEvent.isPrimary) {
          updateValue(pointerMoveEvent.clientX);
        }
      });

      this.addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this.removeEventListener("pointermove", pointerMoveListener);
        this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

        if (changeStarted) {
          this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
        }
      });
    }

    _onKeyDown(event) {
      if (event.code === "ArrowLeft" || event.code === "ArrowDown") {
        event.preventDefault();
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

        let oldValue = this.value;

        if (event.shiftKey) {
          this.value -= this.step * 10;
        }
        else {
          this.value -= this.step;
        }

        if (oldValue !== this.value) {
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }

        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
      else if (event.code === "ArrowRight" || event.code === "ArrowUp") {
        event.preventDefault();
        this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

        let oldValue = this.value;

        if (event.shiftKey) {
          this.value += this.step * 10;
        }
        else {
          this.value += this.step;
        }

        if (oldValue !== this.value) {
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }

        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
      }
    }
  }

  customElements.define("x-slider", XSliderElement);

  let shadowTemplate$p = html`
  <template>
    <style>
      :host {
        display: flex;
        flex-flow: row;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: fit-content;
        --button-color: rgba(0, 0, 0, 0.6);
        --button-border-left: none;
        --pressed-button-color: white;
        --pressed-button-background: rgba(0, 0, 0, 0.3);
        --increment-arrow-width: 11px;
        --increment-arrow-height: 11px;
        --increment-arrow-path-d: path("M 24 69 L 50 43 L 76 69 L 69 76 L 50 58 L 31 76 L 24 69 Z" );
        --decrement-arrow-width: 11px;
        --decrement-arrow-height: 11px;
        --decrement-arrow-path-d: path("M 24 32 L 50 58 L 76 32 L 69 25 L 50 44 L 31 25 L 24 32 Z" );
      }
      :host(:hover) {
        cursor: default;
      }

      #increment-button,
      #decrement-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        user-select: none;
        box-sizing: border-box;
        color: var(--button-color);
        border-left: var(--button-border-left);
      }
      #increment-button[data-pressed],
      #decrement-button[data-pressed] {
        color: var(--pressed-button-color);
        background: var(--pressed-button-background);
      }
      :host([disabled="increment"]) #increment-button,
      :host([disabled="decrement"]) #decrement-button,
      :host([disabled=""]) #increment-button,
      :host([disabled=""]) #decrement-button {
        opacity: 0.3;
        pointer-events: none;
      }

      #increment-arrow {
        width: var(--increment-arrow-width);
        height: var(--increment-arrow-height);
        pointer-events: none;
      }
      #decrement-arrow {
        width: var(--decrement-arrow-width);
        height: var(--decrement-arrow-height);
        pointer-events: none;
      }

      #increment-arrow-path {
        d: var(--increment-arrow-path-d);
        fill: currentColor;
      }
      #decrement-arrow-path {
        d: var(--decrement-arrow-path-d);
        fill: currentColor;
      }
    </style>

    <div id="decrement-button" class="button">
      <svg id="decrement-arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="decrement-arrow-path"></path>
      </svg>
    </div>

    <div id="increment-button" class="button">
      <svg id="increment-arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="increment-arrow-path"></path>
      </svg>
    </div>
  </template>
`;

  // @events
  //   increment
  //   incrementstart
  //   incrementend
  //   decrement
  //   decrementstart
  //   decrementend
  class XStepperElement extends HTMLElement {
    static get observedAttributes() {
      return ["disabled"];
    }

    // @type
    //   true || false || "increment" || "decrement"
    // @default
    //   "false"
    get disabled() {
      if (this.hasAttribute("disabled")) {
        if (this.getAttribute("disabled") === "increment") {
          return "increment";
        }
        else if (this.getAttribute("disabled") === "decrement") {
          return "decrement";
        }
        else {
          return true;
        }
      }
      else {
        return false;
      }
    }
    set disabled(disabled) {
      if (disabled === true) {
        this.setAttribute("disabled", "");
      }
      else if (disabled === false) {
        this.removeAttribute("disabled");
      }
      else {
        this.setAttribute("disabled", disabled);
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$p.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this._shadowRoot.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    }

    attributeChangedCallback(name) {
      if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onDisabledAttributeChange() {
      if (this.hasAttribute("disabled")) {
        this["#increment-button"].removeAttribute("data-pressed");
        this["#decrement-button"].removeAttribute("data-pressed");
      }
    }

    async _onPointerDown(pointerDownEvent) {
      let button = pointerDownEvent.target.closest(".button");
      let action = null;

      if (button === this["#increment-button"]) {
        action = "increment";
      }
      else if (button === this["#decrement-button"]) {
        action = "decrement";
      }

      if (pointerDownEvent.buttons !== 1 || action === null) {
        return;
      }

      // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
      // to last at least 100ms.
      {
        let pointerDownTimeStamp = Date.now();

        button.setAttribute("data-pressed", "");
        this.setPointerCapture(pointerDownEvent.pointerId);

        this.addEventListener("lostpointercapture", async (event) => {
          let pressedTime = Date.now() - pointerDownTimeStamp;
          let minPressedTime = 100;

          if (pressedTime < minPressedTime) {
            await sleep(minPressedTime - pressedTime);
          }

          button.removeAttribute("data-pressed");
        }, {once: true});
      }

      // Dispatch events
      {
        let intervalID = null;
        let pointerDownTimeStamp = Date.now();
        let {shiftKey} = pointerDownEvent;

        this.dispatchEvent(new CustomEvent(action + "start", {bubbles: true}));
        this.dispatchEvent(new CustomEvent(action, {bubbles: true, detail: {shiftKey}}));

        this.addEventListener("lostpointercapture", async (event) => {
          clearInterval(intervalID);
          this.dispatchEvent(new CustomEvent(action + "end", {bubbles: true}));
        }, {once: true});

        intervalID = setInterval(() => {
          if (Date.now() - pointerDownTimeStamp > 500) {
            this.dispatchEvent(new CustomEvent(action, {bubbles: true, detail: {shiftKey}}));
          }
        }, 100);
      }
    }
  }

  customElements.define("x-stepper", XStepperElement);

  let shadowTemplate$q = html`
  <template>
    <style>
      :host {
        display: block;
        width: 22px;
        height: 22px;
        cursor: default;
        box-sizing: border-box;
        overflow: hidden;
      }

      #main {
        width: 100%;
        height: 100%;
        position: relative;
      }

      #selected-icon {
        display: none;
        position: absolute;
        left: calc(50% - 8px);
        top: calc(50% - 8px);
        width: 16px;
        height: 16px;
        color: white;
      }
      :host([showicon]:hover) #selected-icon {
        display: block;
        opacity: 0.6;
      }
      :host([showicon][selected]) #selected-icon {
        display: block;
        opacity: 1;
      }
      :host([showicon][value="#FFFFFF"]) #selected-icon {
        fill: gray;
      }
    </style>

    <main id="main">
      <x-icon id="selected-icon" name="send"></x-icon>
    </main>
  </template>
`;

  class XSwatchElement extends HTMLElement {
    static get observedAttributes() {
      return ["disabled"];
    }

    // @info
    //   Value associated with this button.
    // @type
    //   string
    // @default
    //   "white"
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : "white";
    }
    set value(value) {
      this.setAttribute("value", value);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get selected() {
      return this.hasAttribute("selected");
    }
    set selected(selected) {
      selected ? this.setAttribute("selected", "") : this.removeAttribute("selected");
    }

    // @info
    //   Whether to show selection icon on hover and when the swatch is selected.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get showicon() {
      return this.hasAttribute("showicon");
    }
    set showicon(showicon) {
      showicon ? this.setAttribute("showicon", "") : this.removeAttribute("showicon");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$q.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      this._update();
    }

    attributeChangedCallback(name) {
      if (name === "value") {
        this._update();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      this["#main"].style.background = this.value;
    }
  }

  customElements.define("x-swatch", XSwatchElement);

  let easing$5 = "cubic-bezier(0.4, 0, 0.2, 1)";
  let $oldTabIndex$a = Symbol();

  let shadowTemplate$r = html`
  <template>
    <style>
      :host {
        display: block;
        width: 30px;
        height: 18px;
        margin: 0 8px 0 0;
        box-sizing: border-box;
        display: flex;
        --focus-ring-color: currentColor;
        --focus-ring-opacity: 0.2;
        --focus-ring-width: 10px;
        --focus-ring-transition-duration: 0.15s;
        --ripple-type: none; /* unbounded, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.2;
        --thumb-color: currentColor;
        --thumb-size: 20px;
        --thumb-border-radius: 999px;
        --track-height: 65%;
        --track-color: currentColor;
        --track-opacity: 0.5;
        --track-border-radius: 999px;
      }
      :host([disabled]) {
        opacity: 0.5;
        pointer-events: none;
      }
      :host(:focus) {
        outline: none;
      }

      #main {
        width: 100%;
        height: 100%;
        position: relative;
      }

      /**
       * Track
       */

      #track {
        width: 100%;
        height: var(--track-height);
        background: var(--track-color);
        opacity: var(--track-opacity);
        border-radius: var(--track-border-radius);
      }

      /**
       * Thumb
       */

      #thumb {
        position: absolute;
        left: 0px;
        width: var(--thumb-size);
        height: var(--thumb-size);
        background: var(--thumb-color);
        border-radius: var(--thumb-border-radius);
        transition: left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host([toggled]) #thumb {
        left: calc(100% - var(--thumb-size));
      }
      :host([mixed]) #thumb {
        left: calc(50% - var(--thumb-size) / 2);
      }

      /**
       * Focus ring
       */

      #focus-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        width: var(--thumb-size);
        height: var(--thumb-size);
        transform: translate(-50%, -50%);
        background: transparent;
        border: 0px solid var(--focus-ring-color);
        border-radius: 999px;
        opacity: var(--focus-ring-opacity);
        transition: border-width var(--focus-ring-transition-duration) cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host(:focus) #thumb #focus-ring {
        border-width: var(--focus-ring-width);
      }

      /**
       * Ripples
       */

      #ripples .ripple {
        position: absolute;
        top: 50%;
        left: 50%;
        width: calc(var(--thumb-size) + 22px);
        height: calc(var(--thumb-size) + 22px);
        transform: translate(-50%, -50%);
        background: var(--ripple-background);
        border-radius: 999px;
        opacity: var(--ripple-opacity);
      }
    </style>

    <x-box id="main">
      <div id="track"></div>

      <div id="thumb">
        <div id="focus-ring"></div>
        <div id="ripples"></div>
      </div>
    </x-box>
  </template>
`;

  // @events
  //   toggle
  class XSwitchElement extends HTMLElement {
    static get observedAttributes() {
      return ["toggled", "disabled"];
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get toggled() {
      return this.hasAttribute("toggled");
    }
    set toggled(toggled) {
      toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$r.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      this._updateAccessabilityAttributes();
    }

    attributeChangedCallback(name) {
      if (name === "toggled") {
        this._onToggledAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "switch");
      this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$a] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$a] > 0) ? this[$oldTabIndex$a] : 0;
        }

        delete this[$oldTabIndex$a];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onToggledAttributeChange() {
      this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
    }

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    _onPointerDown(event) {
      if (event.buttons !== 1) {
        event.preventDefault();
        return;
      }

      // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
      if (this.matches(":focus") === false) {
        event.preventDefault();

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      // Ripple
      {
        let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

        if (rippleType === "unbounded") {
          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple");
          this["#ripples"].append(ripple);

          let transformAnimation = ripple.animate(
            { transform: ["translate(-50%, -50%) scale(0)", "translate(-50%, -50%) scale(1)"] },
            { duration: 200, easing: easing$5 }
          );

          this.setPointerCapture(event.pointerId);

          this.addEventListener("lostpointercapture", async () => {
            await transformAnimation.finished;

            let opacityAnimation = ripple.animate(
              { opacity: [getComputedStyle(ripple).opacity, "0"] },
              { duration: 200, easing: easing$5 }
            );

            await opacityAnimation.finished;

            ripple.remove();
          }, {once: true});
        }
      }
    }

    async _onClick(event) {
      // Update state
      {
        if (this.mixed) {
          this.mixed = false;
        }
        else {
          this.toggled = !this.toggled;
        }

        this.dispatchEvent(new CustomEvent("toggle"));
      }

      // Ripple
      if (event.isTrusted === false) {
        let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

        if (rippleType === "unbounded") {
          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple");
          this["#ripples"].append(ripple);

          await ripple.animate(
            { transform: ["translate(-50%, -50%) scale(0)", "translate(-50%, -50%) scale(1)"] },
            { duration: 200, easing: easing$5 }
          ).finished;

          await ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"] },
            { duration: 200, easing: easing$5 }
          ).finished;

          ripple.remove();
        }
      }
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        this.click();
      }
    }
  }
  customElements.define("x-switch", XSwitchElement);

  let {max: max$6} = Math;
  let easing$6 = "cubic-bezier(0.4, 0, 0.2, 1)";

  let shadowTemplate$s = html`
  <template>
    <style>
      :host {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        box-sizing: border-box;
        cursor: default;
        user-select: none;
        --menu-position: below; /* over, below */
        --trigger-effect: none; /* ripple, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.2;
        --arrow-width: 9px;
        --arrow-height: 9px;
        --arrow-margin: 1px 0 0 3px;
        --arrow-d: path("M 11.7 19.9 L 49.8 57.9 L 87.9 19.9 L 99.7 31.6 L 49.8 81.4 L -0.01 31.6 Z");
        --selection-indicator-height: 3px;
        --selection-indicator-background: white;
      }
      :host(:focus) {
        outline: none;
      }

      #content {
        display: inherit;
        flex-flow:inherit;
        align-items: inherit;
        z-index: 100;
      }

      /**
       * Arrow
       */

      #arrow {
        width: var(--arrow-width);
        height: var(--arrow-height);
        margin: var(--arrow-margin);
        color: currentColor;
        d: var(--arrow-d);
      }

      #arrow-path {
        fill: currentColor;
        d: inherit;
      }

      /**
       * Ripples
       */

      #ripples {
        position: absolute;
        z-index: 0;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        pointer-events: none;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 200px;
        height: 200px;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        transform: none;
        transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: opacity, transform;
        pointer-events: none;
      }

      /**
       * Selection indicator
       */

      #selection-indicator {
        display: none;
        width: 100%;
        height: var(--selection-indicator-height);
        background: var(--selection-indicator-background);
        position: absolute;
        bottom: 0;
        left: 0;
      }
      :host([selected]) #selection-indicator {
        display: block;
      }
      :host-context([animatingindicator]) #selection-indicator {
        display: none;
      }
    </style>

    <div id="ripples"></div>
    <div id="selection-indicator"></div>

    <div id="content">
      <slot></slot>

      <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none" hidden>
        <path id="arrow-path"></path>
      </svg>
    </div>
  </template>
`;

  class XTabElement extends HTMLElement {
    static get observedAttributes() {
      return ["selected", "disabled"];
    }

    // @info
    //   Value associated with this tab.
    // @type
    //   string
    // @default
    //   ""
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : "";
    }
    set value(value) {
      this.setAttribute("value", value);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get selected() {
      return this.hasAttribute("selected");
    }
    set selected(selected) {
      selected ? this.setAttribute("selected", "") : this.removeAttribute("selected");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$s.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
    }

    connectedCallback() {
      this.setAttribute("tabindex", this.selected ? "0" : "-1");
      this.setAttribute("role", "tab");
      this.setAttribute("aria-selected", this.selected);
      this.setAttribute("aria-disabled", this.disabled);

      this._updateArrowVisibility();
    }

    attributeChangedCallback(name) {
      if (name === "selected") {
        this._onSelectedAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateArrowVisibility() {
      let menu = this.querySelector("x-menu");
      let popover = this.querySelector("x-popover");
      this["#arrow"].style.display = (menu === null && popover === null) ? "none" : null;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onSelectedAttributeChange() {
      this.setAttribute("aria-selected", this.selected);
      this.setAttribute("tabindex", this.selected ? "0" : "-1");
    }

    _onDisabledAttributeChange() {
      this.setAttribute("aria-disabled", this.disabled);
      this.setAttribute("tabindex", this.selected ? "0" : "-1");
    }

    async _onPointerDown(pointerDownEvent) {
      // Don't focus the tab with pointer
      if (this.matches(":focus") === false && !pointerDownEvent.target.closest("x-menu, x-popup")) {
        pointerDownEvent.preventDefault();

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      if (pointerDownEvent.buttons !== 1 || this.querySelector("x-menu")) {
        return;
      }

      // Provide "pressed" attribute for theming purposes
      {
        let pointerDownTimeStamp = Date.now();

        this.setAttribute("pressed", "");
        this.setPointerCapture(pointerDownEvent.pointerId);

        this.addEventListener("lostpointercapture", async (event) => {
          if (this.selected === true) {
            let pressedTime = Date.now() - pointerDownTimeStamp;
            let minPressedTime = 100;

            if (pressedTime < minPressedTime) {
              await sleep(minPressedTime - pressedTime);
            }
          }

          this.removeAttribute("pressed");
        }, {once: true});
      }

      // Ripple
      {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        if (triggerEffect === "ripple") {
          let bounds = this["#ripples"].getBoundingClientRect();
          let size = max$6(bounds.width, bounds.height) * 1.5;
          let top  = pointerDownEvent.clientY - bounds.y - size/2;
          let left = pointerDownEvent.clientX - bounds.x - size/2;
          let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple pointer-down-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
          this["#ripples"].append(ripple);

          this.setPointerCapture(pointerDownEvent.pointerId);

          // Workaround for tabs that that change their color when selected
          ripple.hidden = true;
          await sleep(10);
          ripple.hidden = false;

          let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing: easing$6 });

          await whenLostPointerCapture;
          await inAnimation.finished;

          let fromOpacity = getComputedStyle(ripple).opacity;
          let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"]}, { duration: 300, easing: easing$6 });
          await outAnimation.finished;

          ripple.remove();
        }
      }
    }

    async _onClick(event) {
      // Ripple
      if (this["#ripples"].querySelector(".pointer-down-ripple") === null && !this.querySelector("x-menu")) {
        let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

        if (triggerEffect === "ripple") {
          let bounds = this["#ripples"].getBoundingClientRect();
          let size = max$6(bounds.width, bounds.height) * 1.5;
          let top  = (bounds.y + bounds.height/2) - bounds.y - size/2;
          let left = (bounds.x + bounds.width/2) - bounds.x - size/2;

          let ripple = createElement("div");
          ripple.setAttribute("class", "ripple click-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
          this["#ripples"].append(ripple);

          let inAnimation = ripple.animate({ transform: ["scale(0)", "scale(1)"]}, { duration: 300, easing: easing$6 });
          await inAnimation.finished;

          let fromOpacity = getComputedStyle(ripple).opacity;
          let outAnimation = ripple.animate({ opacity: [fromOpacity, "0"] }, { duration: 300, easing: easing$6 });
          await outAnimation.finished;

          ripple.remove();
        }
      }
    }
  }

  customElements.define("x-tab", XTabElement);

  let shadowTemplate$t = html`
  <template>
    <style>
      :host {
        position: relative;
        display: flex;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        justify-content: flex-start;
      }
      :host([centered]) {
        margin: 0 auto;
        justify-content: center;
      }

      :host([centered]) ::slotted(x-tab) {
        flex: 0;
      }

      #selection-indicator {
        position: absolute;
        width: 100%;
        height: fit-content;
        bottom: 0;
        left: 0;
        pointer-events: none;
      }
    </style>

    <slot></slot>
    <div id="selection-indicator" hidden></div>
  </template>
`;

  // @events
  //   change
  class XTabsElement extends HTMLElement {
    // @type
    //   string?
    // @default
    //   null
    get value() {
      let selectedTab = this.querySelector("x-tab[selected]");
      return selectedTab ? selectedTab.value : null;
    }
    set value(value) {
      let tabs = [...this.querySelectorAll("x-tab")];
      let selectedTab = (value === null) ? null : tabs.find(tab => tab.value === value);

      for (let tab of tabs) {
        tab.selected = (tab === selectedTab);
      }
    }

    // @property
    //   reflected
    // @type
    //   boolean
    // @default
    //   false
    get centered() {
      return this.hasAttribute("centered");
    }
    set centered(centered) {
      centered === true ? this.setAttribute("centered", "") : this.removeAttribute("centered");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._wasFocusedBeforeExpanding = false;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$t.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#backdrop"] = createElement("x-backdrop");
      this["#backdrop"].style.background = "rgba(0, 0, 0, 0)";

      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      this.setAttribute("role", "tablist");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Expands given tab by opening its menu.
    _expand(tab) {
      return new Promise( async (resolve) => {
        let menu = tab.querySelector(":scope > x-menu");
        let label = tab.querySelector("x-label");

        if (menu) {
          this._wasFocusedBeforeExpanding = this.querySelector("*:focus") !== null;

          let over = getComputedStyle(tab).getPropertyValue("--menu-position").trim() === "over";
          let whenOpened = over ? menu.openOverLabel(label) :  menu.openNextToElement(tab, "vertical", 3);

          tab.setAttribute("expanded", "");

          // When menu closes, focus the tab
          menu.addEventListener("close", () => {
            let tabs = this.querySelectorAll("x-tab");
            let closedTab = tab;

            if (this._wasFocusedBeforeExpanding) {
              for (let tab of tabs) {
                tab.tabIndex = (tab === closedTab ? 0 : -1);
              }

              closedTab.focus();
            }
            else {
              for (let tab of tabs) {
                tab.tabIndex = (tab.selected ? 0 : -1);
              }

              let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

              if (ancestorFocusableElement) {
                ancestorFocusableElement.focus();
              }
            }
          }, {once: true});

          await whenOpened;

          if (!tab.querySelector("*:focus")) {
            menu.focus();
          }

          this["#backdrop"].ownerElement = menu;
          this["#backdrop"].show(false);
        }

        resolve();
      });
    }

    // @info
    //   Collapses currently expanded tab by closing its menu.
    _collapse(delay) {
      return new Promise( async (resolve) => {
        let menu = this.querySelector("x-menu[opened]");

        if (menu && !menu.hasAttribute("closing")) {
          let tabs = this.querySelectorAll("x-tab");
          let closedTab = menu.closest("x-tab");
          menu.setAttribute("closing", "");

          await delay;
          await menu.close();

          this["#backdrop"].hide(false);

          menu.removeAttribute("closing");
          closedTab.removeAttribute("expanded");
        }
      });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _animateSelectionIndicator(startTab, endTab) {
      return new Promise( async (resolve) => {
        let mainBBox = this.getBoundingClientRect();
        let startBBox = startTab ? startTab.getBoundingClientRect() : null;
        let endBBox = endTab.getBoundingClientRect();
        let computedStyle = getComputedStyle(endTab);

        if (startBBox === null) {
          startBBox = DOMRect.fromRect(endBBox);
          startBBox.x += startBBox.width / 2;
          startBBox.width = 0;
        }

        this["#selection-indicator"].style.height = computedStyle.getPropertyValue("--selection-indicator-height");

        if (this["#selection-indicator"].style.height !== "0px") {
          this["#selection-indicator"].style.background = computedStyle.getPropertyValue("--selection-indicator-background");
          this["#selection-indicator"].hidden = false;

          this.setAttribute("animatingindicator", "");

          let animation = this["#selection-indicator"].animate(
            [
              {
                bottom: (startBBox.bottom - mainBBox.bottom) + "px",
                left: (startBBox.left - mainBBox.left) + "px",
                width: startBBox.width + "px",
              },
              {
                bottom: (endBBox.bottom - mainBBox.bottom) + "px",
                left: (endBBox.left - mainBBox.left) + "px",
                width: endBBox.width + "px",
              }
            ],
            {
              duration: 100,
              iterations: 1,
              delay: 0,
              easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
            }
          );

          await animation.finished;

          this["#selection-indicator"].hidden = true;
          this.removeAttribute("animatingindicator");
        }

        resolve();
      });
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onClick(event) {
      if (event.button !== 0) {
        return;
      }

      if (event.target.closest("x-backdrop")) {
        this._collapse();
      }

      else if (event.target.closest("x-menu")) {
        let clickedMenuItem = event.target.closest("x-menuitem");

        if (clickedMenuItem && clickedMenuItem.disabled === false) {
          let submenu = clickedMenuItem.querySelector("x-menu");

          if (submenu) {
            if (submenu.opened) {
              submenu.close();
            }
            else {
              submenu.openNextToElement(clickedMenuItem, "horizontal");
            }
          }
          else {
            this._collapse(clickedMenuItem.whenTriggerEnd);
          }
        }
      }

      else if (event.target.closest("x-tab")) {
        let tabs = this.querySelectorAll("x-tab");
        let clickedTab = event.target.closest("x-tab");
        let selectedTab = this.querySelector("x-tab[selected]");
        let submenu = clickedTab.querySelector(":scope > x-menu");

        if (clickedTab !== selectedTab) {
          // Open a popup menu
          if (submenu) {
            this._expand(clickedTab);
          }

          // Select the tab
          else {
            for (let tab of tabs) {
              tab.selected = (tab === clickedTab);
            }

            this._animateSelectionIndicator(selectedTab, clickedTab);
            this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
          }
        }
      }
    }

    _onKeyDown(event) {
      if (event.code === "Enter" || event.code === "Space") {
        let tab = event.target;
        let menu = tab.querySelector("x-menu");
        let label = tab.querySelector("x-label");

        if (menu) {
          if (menu.opened) {
            this._collapse();
            event.preventDefault();
          }
          else {
            this._expand(tab);
            event.preventDefault();
          }
        }
        else {
          event.preventDefault();
          tab.click();
        }
      }

      else if (event.code === "Escape") {
        let tab = event.target.closest("x-tab");
        let menu = tab.querySelector("x-menu");

        if (menu) {
          this._collapse();
        }
      }

      else if (event.code === "ArrowLeft") {
        let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
        let currentTab = this.querySelector(`x-tab[tabindex="0"]`);
        let clickedTab = event.target;
        let openedTabMenu = this.querySelector("x-menu[opened]");

        event.preventDefault();

        if (openedTabMenu) ;
        else if (currentTab && tabs.length > 0) {
          let currentTabIndex = tabs.indexOf(currentTab);
          let previousTab = tabs[currentTabIndex - 1] || tabs[tabs.length - 1];

          currentTab.tabIndex = -1;
          previousTab.tabIndex = 0;
          previousTab.focus();
        }
      }

      else if (event.code === "ArrowRight") {
        let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
        let currentTab = this.querySelector(`x-tab[tabindex="0"]`);
        let clickedTab = event.target;
        let openedTabMenu = this.querySelector("x-menu[opened]");

        event.preventDefault();

        if (openedTabMenu) ;
        else if (currentTab && tabs.length > 0) {
          let currentTabIndex = tabs.indexOf(currentTab);
          let nextTab = tabs[currentTabIndex + 1] || tabs[0];

          currentTab.tabIndex = -1;
          nextTab.tabIndex = 0;
          nextTab.focus();
        }
      }

      else if (event.code === "ArrowUp") {
        let tab = event.target.closest("x-tab");
        let menu = tab.querySelector("x-menu");

        if (menu) {
          event.preventDefault();

          if (menu.opened) {
            let lastMenuItem = menu.querySelector(":scope > x-menuitem:last-of-type:not([disabled])");

            if (lastMenuItem) {
              lastMenuItem.focus();
            }
          }
          else {
            this._expand(tab);
          }
        }
      }

      else if (event.code === "ArrowDown") {
        let tab = event.target.closest("x-tab");
        let menu = tab.querySelector("x-menu");

        if (menu) {
          event.preventDefault();

          if (menu.opened) {
            let firstMenuItem = menu.querySelector(":scope > x-menuitem:not([disabled])");

            if (firstMenuItem) {
              firstMenuItem.focus();
            }
          }
          else {
            this._expand(tab);
          }
        }
      }
    }
  }

  customElements.define("x-tabs", XTabsElement);

  let $oldTabIndex$b = Symbol();

  let shadowTemplate$u = html`
  <template>
    <style>
      :host {
        display: flex;
        align-items: center;
        position: relative;
        box-sizing: border-box;
        min-height: 24px;
        background: white;
        border: 1px solid #BFBFBF;
        font-size: 12px;
        --close-button-path-d: path(
          "M 25 16 L 50 41 L 75 16 L 84 25 L 59 50 L 84 75 L 75 84 L 50 59 L 25 84 L 16 75 L 41 50 L 16 25 Z"
        );
        --selection-color: currentColor;
        --selection-background: #B2D7FD;
        --tag-background: rgba(0, 0, 0, 0.04);
        --tag-border: 1px solid #cccccc;
        --tag-color: currentColor;
      }
      :host(:focus) {
        outline: 1px solid blue;
      }
      :host([error]) {
        --selection-color: white;
        --selection-background: #d50000;
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      ::selection {
        color: var(--selection-color);
        background: var(--selection-background);
      }

      #main {
        width: 100%;
        height: 100%;
        min-height: inherit;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: center;
        align-content: flex-start;
        cursor: text;
      }

      #items {
        display: flex;
        flex-wrap: wrap;
        padding: 2px;
      }
      :host([mixed]) #items {
        opacity: 0.7;
      }

      .item {
        height: 100%;
        margin: 2px;
        padding: 0px 3px 0 6px;
        display: flex;
        line-height: 1.2;
        align-items: center;
        justify-content: center;
        background: var(--tag-background);
        border: var(--tag-border);
        color: var(--tag-color);
        font-size: inherit;
        cursor: default;
        user-select: none;
      }
      .item#editable-item {
        color: inherit;
        outline: none;
        background: none;
        border: 1px solid transparent;
        flex-grow: 1;
        align-items: center;
        justify-content: flex-start;
        white-space: pre;
        cursor: text;
        user-select: text;
      }

      .item .close-button {
        color: inherit;
        opacity: 0.8;
        width: 11px;
        height: 11px;
        vertical-align: middle;
        margin-left: 4px;
      }
      .item .close-button:hover {
        background: rgba(0, 0, 0, 0.1);
        opacity: 1;
      }

      .item .close-button-path {
        fill: currentColor;
        d: var(--close-button-path-d);
      }
    </style>

    <main id="main">
      <div id="items">
        <span id="editable-item" class="item" spellcheck="false"></span>
      </div>
      <slot></slot>
    </main>
  </template>
`;

  // @events
  //   input
  //   change
  //   textinputmodestart
  //   textinputmodeend
  class XTagInputElement extends HTMLElement {
    static get observedAttributes() {
      return ["value", "spellcheck", "disabled"];
    }

    // @type
    //   Array<string>
    // @default
    //   []
    // @attribute
    get value() {
      if (this.hasAttribute("value")) {
        return this.getAttribute("value").split(this.delimiter).map($0 => $0.trim()).filter($0 => $0 !== "");
      }
      else {
        return [];
      }
    }
    set value(value) {
      if (value.length === 0) {
        this.removeAttribute("value");
      }
      else {
        this.setAttribute("value", value.join(this.delimiter));
      }
    }

    // @type
    //   string
    get delimiter() {
      return this.hasAttribute("delimiter") ? this.getAttribute("delimiter") : ",";
    }
    set delimiter(delimiter) {
      this.setAttribute("delimiter", delimiter);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get spellcheck() {
      return this.hasAttribute("spellcheck");
    }
    set spellcheck(spellcheck) {
      spellcheck ? this.setAttribute("spellcheck", "") : this.removeAttribute("spellcheck");
    }

    // @type
    //   string
    get prefix() {
      return this.hasAttribute("prefix") ? this.getAttribute("prefix") : "";
    }
    set prefix(prefix) {
      prefix === "" ? this.removeAttribute("prefix") : this.setAttribute("prefix", prefix);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate$u.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("focusin", (event) => this._onFocusIn(event));
      this.addEventListener("focusout", (event) => this._onFocusOut(event));
      this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
      this._shadowRoot.addEventListener("click", (event) => this._onShadowRootClick(event));
      this["#editable-item"].addEventListener("keydown", (event) => this._onInputKeyDown(event));
      this["#editable-item"].addEventListener("input", (event) => this._onInputInput(event));
    }

    connectedCallback() {
      this._update();
      this._updateAccessabilityAttributes();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "value") {
        this._onValueAttributeChange();
      }
      else if (name === "spellcheck") {
        this._onSpellcheckAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    // @info
    //   Override this method if you want the entered tags to match specific criteria.
    // @type
    //   (string) => boolean
    validateTag(tag) {
      return true;
    }

    _commitInput() {
      this._updateValidityState();

      if (this.hasAttribute("error") === false) {
        let tag = this["#editable-item"].textContent.trim();
        this["#editable-item"].textContent = "";

        if (tag.length > 0) {
          if (this.value.includes(tag) === false) {
            let value = this.value.filter($0 => $0 !== tag);
            this.value = [...value, tag];
            this.dispatchEvent(new CustomEvent("change"));
          }
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      for (let item of [...this["#items"].children]) {
        if (item !== this["#editable-item"]) {
          item.remove();
        }
      }

      for (let tag of this.value) {
        this["#editable-item"].insertAdjacentHTML("beforebegin", `
        <div class="item" data-tag="${tag}">
          <label>${this.prefix}${tag}</label>
          <svg class="close-button" viewBox="0 0 100 100"><path class="close-button-path"></path></svg>
        </div>
      `);
      }

      this._updatePlaceholderVisibility();
    }

    _updateValidityState() {
      let tag = this["#editable-item"].textContent.trim();

      if (this.validateTag(tag) === true || tag.length === 0) {
        this.removeAttribute("error");
      }
      else {
        this.setAttribute("error", "");
      }
    }

    _updatePlaceholderVisibility() {
      let placeholder = this.querySelector(":scope > x-label");

      if (placeholder) {
        placeholder.hidden = (this.value.length > 0 || this["#editable-item"].textContent.length > 0);
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "input");
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$b] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$b] > 0) ? this[$oldTabIndex$b] : 0;
        }

        delete this[$oldTabIndex$b];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      this._update();
    }

    _onSpellcheckAttributeChange() {
      this["#editable-item"].spellcheck = this.spellcheck;
    }

    _onDisabledAttributeChange() {
      this._updateAccessabilityAttributes();
    }

    _onFocusIn() {
      this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
    }

    _onFocusOut() {
      this._commitInput();
      this["#editable-item"].removeAttribute("contenteditable");
      this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));

      if (this.hasAttribute("error")) {
        this["#editable-item"].textContent = "";
        this.removeAttribute("error");
      }
    }

    _onShadowRootPointerDown(event) {
      if (event.target === this["#main"] || event.target === this["#items"]) {
        event.preventDefault();

        this["#editable-item"].setAttribute("contenteditable", "");

        let range = new Range();
        range.selectNodeContents(this["#editable-item"]);
        range.collapse(false);

        let selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }

      else if (event.target.matches(`.item, .item > *`)) {
        let item = event.target.closest(".item");
        let closeButton = event.target.closest(".close-button");

        if (item !== this["#editable-item"] && !closeButton) {
          event.preventDefault();
          event.stopPropagation();
          this["#editable-item"].focus();
          this._commitInput();
        }
      }
    }

    _onShadowRootClick(event) {
      if (event.target.closest(".close-button")) {
        this._onCloseButtonClick(event);
      }
    }

    _onCloseButtonClick(event) {
      let item = event.target.closest(".item");
      this.value = this.value.filter(tag => tag !== item.getAttribute("data-tag"));
      this.dispatchEvent(new CustomEvent("change"));
    }

    _onInputKeyDown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        this._commitInput();
      }
      else if (event.key === "Backspace") {
        let value = this["#editable-item"].textContent;

        if (value.length === 0) {
          this.value = this.value.slice(0, this.value.length - 1);
          this.dispatchEvent(new CustomEvent("change"));
        }
      }
    }

    _onInputInput() {
      let value = this["#editable-item"].textContent;

      if (value.includes(this.delimiter)) {
        this._commitInput();
      }

      this._updatePlaceholderVisibility();

      if (this.hasAttribute("error")) {
        this._updateValidityState();
      }

      this.dispatchEvent(new CustomEvent("input"));
    }
  }
  customElements.define("x-taginput", XTagInputElement);

  let $oldTabIndex$c = Symbol();

  let shadowTemplate$v = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        width: 100%;
        min-height: 100px;
        box-sizing: border-box;
        background: white;
        color: #000000;
        --selection-color: currentColor;
        --selection-background: #B2D7FD;
        --inner-padding: 0;
      }
      :host(:hover) {
        cursor: text;
      }
      :host([error]) {
        --selection-color: white;
        --selection-background: #d50000;
      }
      :host([mixed]) {
        color: rgba(0, 0, 0, 0.7);
      }
      :host([disabled]) {
        pointer-events: none;
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      ::selection {
        color: var(--selection-color);
        background: var(--selection-background);
      }

      ::-webkit-scrollbar {
        max-width: 6px;
        max-height: 6px;
        background: none;
      }
      ::-webkit-scrollbar-track {
        border-radius: 25px;
      }
      ::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 25px;
      }
      ::-webkit-scrollbar-corner {
        display: none
      }

      #main {
        display: flex;
        flex-flow: column;
        height: 100%;
        min-height: inherit;
        max-height: inherit;
        overflow-y: auto;
      }

      #editor {
        flex: 1;
        padding: var(--inner-padding);
        box-sizing: border-box;
        color: inherit;
        background: none;
        border: none;
        outline: none;
        font-family: inherit;
        font-size: inherit;
        overflow: auto;
      }

      /* Error text */
      :host([error])::before {
        position: absolute;
        left: 0;
        bottom: -20px;
        box-sizing: border-box;
        color: #d50000;
        font-family: inherit;
        font-size: 11px;
        line-height: 1.2;
        white-space: pre;
        content: attr(error) " ";
      }
    </style>

    <main id="main">
      <slot></slot>
      <div id="editor" contenteditable="plaintext-only" spellcheck="false"></div>
    </main>
  </template>
`;

  // @events
  //   input
  //   change
  //   textinputmodestart
  //   textinputmodeend
  class XTextareaElement extends HTMLElement {
    static get observedAttributes() {
      return ["value", "spellcheck", "disabled", "validation"];
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get value() {
      return this["#editor"].textContent;
    }
    set value(value) {
      this["#editor"].textContent = value;

      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }

      this._updateEmptyState();
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get spellcheck() {
      return this.hasAttribute("spellcheck");
    }
    set spellcheck(spellcheck) {
      spellcheck ? this.setAttribute("spellcheck", "") : this.removeAttribute("spellcheck");
    }

    // @type
    //   number
    // @default
    //   0
    // @attribute
    get minLength() {
      return this.hasAttribute("minlength") ? parseInt(this.getAttribute("minlength")) : 0;
    }
    set minLength(minLength) {
      this.setAttribute("minlength", minLength);
    }

    // @type
    //   number || Infinity
    // @default
    //   0
    // @attribute
    get maxLength() {
      return this.hasAttribute("maxlength") ? parseInt(this.getAttribute("maxlength")) : Infinity;
    }
    set maxLength(maxLength) {
      this.setAttribute("maxlength", maxLength);
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get required() {
      return this.hasAttribute("required");
    }
    set required(required) {
      required ? this.setAttribute("required", "") : this.removeAttribute("required");
    }

    // @info
    //   Whether this textarea has "mixed" state.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get mixed() {
      return this.hasAttribute("mixed");
    }
    set mixed(mixed) {
      mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
    }

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    // @info
    //   "auto"    - validate() is called when input loses focus and when user presses "Enter"
    //   "instant" - validate() is called on each key press
    //   "manual"  - you will call validate() manually when user submits the form
    // @type
    //   "auto" || "instant" || "manual"
    // @default
    //   "auto"
    get validation() {
      return this.hasAttribute("validation") ? this.getAttribute("validation") : "auto";
    }
    set validation(validation) {
      this.setAttribute("validation", validation);
    }

    // @type
    //   string?
    // @default
    //   null
    // @attribute
    get error() {
      return this.getAttribute("error");
    }
    set error(error) {
      error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
      this._shadowRoot.append(document.importNode(shadowTemplate$v.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.addEventListener("focusin", (event) => this._onFocusIn(event));
      this.addEventListener("focusout", (event) => this._onFocusOut(event));

      this["#editor"].addEventListener("click", (event) => this._onEditorClick(event));
      this["#editor"].addEventListener("input", (event) => this._onEditorInput(event));
    }

    connectedCallback() {
      this._updateEmptyState();
      this._updateAccessabilityAttributes();

      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }

    attributeChangedCallback(name) {
      if (name === "value") {
        this._onValueAttributeChange();
      }
      else if (name === "spellcheck") {
        this._onSpellcheckAttributeChange();
      }
      else if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
      else if (name === "validation") {
        this._onValidationAttributeChnage();
      }
    }

    // @info
    //   Override this method to validate the textarea value manually.
    // @type
    //   () => void
    validate() {
      if (this.value.length < this.minLength) {
        this.error = "Entered text is too short";
      }
      else if (this.value.length > this.maxLength) {
        this.error = "Entered text is too long";
      }
      else if (this.required && this.value.length === 0) {
        this.error = "This field is required";
      }
      else {
        this.error = null;
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateEmptyState() {
      if (this.value.length === 0) {
        this.setAttribute("empty", "");
      }
      else {
        this.removeAttribute("empty");
      }
    }

    _updateAccessabilityAttributes() {
      this.setAttribute("role", "input");
      this.setAttribute("aria-disabled", this.disabled);

      if (this.disabled) {
        this[$oldTabIndex$c] = (this.tabIndex > 0 ? this.tabIndex : 0);
        this.tabIndex = -1;
      }
      else {
        if (this.tabIndex < 0) {
          this.tabIndex = (this[$oldTabIndex$c] > 0) ? this[$oldTabIndex$c] : 0;
        }

        delete this[$oldTabIndex$c];
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      this.value = this.hasAttribute("value") ? this.getAttribute("value") : "";

      if (this.matches(":focus")) {
        document.execCommand("selectAll");
      }
    }

    _onSpellcheckAttributeChange() {
      this["#editor"].spellcheck = this.spellcheck;
    }

    _onDisabledAttributeChange() {
      this["#editor"].disabled = this.disabled;
      this._updateAccessabilityAttributes();
    }

    _onValidationAttributeChnage() {
      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto" || this.validation === "manual") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }

    _onFocusIn() {
      this._focusInValue = this.value;
      this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
    }

    _onFocusOut() {
      this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
      this._shadowRoot.getSelection().collapse(this["#main"]);

      if (this.validation === "auto") {
        this.validate();
      }

      if (this.error === null && (this.value !== this._focusInValue || this.mixed)) {
        this.mixed = false;
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    }

    _onEditorClick(event) {
      if (event.detail >= 4) {
        document.execCommand("selectAll");
      }
    }

    _onEditorInput(event) {
      this.dispatchEvent(new CustomEvent("input", {bubbles: true}));
      this._updateEmptyState();

      if (this.validation === "instant") {
        this.validate();
      }
      else if (this.validation === "auto") {
        if (this.error !== null) {
          this.validate();
        }
      }
    }
  }

  customElements.define("x-textarea", XTextareaElement);

  let shadowTemplate$w = html`
  <template>
    <style>
      :host {
        display: block;
        width: 30px;
        height: 30px;
        box-sizing: border-box;
      }
      :host([hidden]) {
        display: none;
      }
      :host([type="ring"]) {
        color: #4285f4;
      }
      :host([type="spin"]) {
        color: #404040;
      }

      #main {
        width: 100%;
        height: 100%;
      }

      svg {
        color: inherit;
        width: 100%;
        height: 100%;
      }
    </style>

    <main id="main"></main>
  </template>
`;

  let ringThrobberSVG = `
  <svg viewBox="0 0 100 100">
    <style>
      ellipse {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-dasharray: 10, 1000;
        animation: dash-animation 2s cubic-bezier(0.8, 0.25, 0.25, 0.9) infinite, rotate-animation 2s linear infinite;
        transform-origin: center;
      }

      @keyframes rotate-animation {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes dash-animation {
        50% {
          stroke-dasharray: 200;
          stroke-dashoffset: 0;
        }
        100% {
          stroke-dasharray: 245;
          stroke-dashoffset: -260;
        }
      }
    </style>

    <ellipse ry="40" rx="40" cy="50" cx="50" stroke-width="10"/>
  </svg>
`;

  let spinThrobberSVG = `
  <svg viewBox="0 0 100 100">
    <style>
      rect {
        x: 46.5px;
        y: 40px;
        width: 7px;
        height: 22px;
        rx: 5px;
        ry: 5px;
        fill: currentColor;
      }
    </style>

    <rect transform="rotate(0 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(30 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.08s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(60 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.17s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(90 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.25s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(120 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.33s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(150 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.42s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(180 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.5s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(210 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.58s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(240 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.66s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(270 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.75s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(300 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.83s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(330 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.92s" repeatCount="indefinite" />
    </rect>
  </svg>
`;

  class XThrobberElement extends HTMLElement {
    static get observedAttributes() {
      return ["type"];
    }

    // @type
    //   "ring" || "spin"
    // @default
    //   "ring"
    // @attribute
    get type() {
      return this.hasAttribute("type") ? this.getAttribute("type") : "ring";
    }
    set type(type) {
      this.setAttribute("type", type);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$w.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      this._update();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "type") {
        this._update();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async _update() {
      this["#main"].innerHTML = (this.type === "ring") ? ringThrobberSVG : spinThrobberSVG;

      if (this.hasAttribute("type") === false) {
        this.setAttribute("type", this.type);
      }
    }
  }

  customElements.define("x-throbber", XThrobberElement);

  let {PI: PI$2, sqrt: sqrt$2, atan2: atan2$1, sin, cos, pow: pow$2} = Math;

  let shadowHTML$3 = `
  <style>
    :host {
      display: block;
      width: 100%;
      user-select: none;
      --wheel-max-width: none;
    }
    :host([hidden]) {
      display: none;
    }

    /**
     * Hue-saturation slider
     */

    #huesat-slider {
      display: flex;
      position: relative;
      width: 100%;
      max-width: var(--wheel-max-width);
      margin: 0 auto;
      height: auto;
      touch-action: pinch-zoom;
    }

    #huesat-image {
      width: 100%;
      height: 100%;
      border-radius: 999px;
      pointer-events: none;
    }

    #huesat-marker {
      position: absolute;
      top: 0%;
      left: 0%;
      width: var(--marker-size);
      height: var(--marker-size);
      transform: translate(calc(var(--marker-size) / -2), calc(var(--marker-size) / -2));
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.3);
      border: 3px solid white;
      border-radius: 999px;
      box-shadow: 0 0 3px black;
      --marker-size: 20px;
    }

    /**
     * Value slider
     */

    #value-slider {
      width: 100%;
      height: 28px;
      margin-top: 10px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border: 1px solid #cecece;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
    }

    #value-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #value-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }

    /**
     * Alpha slider
     */

    #alpha-slider {
      position: relative;
      display: none;
      width: 100%;
      height: 28px;
      margin-top: 14px;
      padding: 0 calc(var(--marker-width) / 2);
      box-sizing: border-box;
      border: 1px solid #cecece;
      border-radius: 2px;
      touch-action: pan-y;
      --marker-width: 18px;
      /* Checkerboard pattern */
      background-color: white;
      background-size: 10px 10px;
      background-position: 0 0, 0 5px, 5px -5px, -5px 0px;
      background-image: linear-gradient(45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(-45deg, #d6d6d6 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #d6d6d6 75%),
                        linear-gradient(-45deg, transparent 75%, #d6d6d6 75%);
    }
    :host([alphaslider]) #alpha-slider {
      display: block;
    }

    #alpha-slider-gradient {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }

    #alpha-slider-track {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
    }

    #alpha-slider-marker {
      position: absolute;
      left: 0%;
      background: rgba(0, 0, 0, 0.2);
      box-shadow: 0 0 3px black;
      box-sizing: border-box;
      transform: translateX(calc((var(--marker-width) / 2) * -1));
      border: 3px solid white;
      width: var(--marker-width);
      height: 32px;
      position: absolute;
    }
  </style>

  <x-box vertical>
    <div id="huesat-slider">
      <img id="huesat-image"></img>
      <div id="huesat-marker"></div>
    </div>

    <div id="value-slider">
      <div id="value-slider-track">
        <div id="value-slider-marker"></div>
      </div>
    </div>

    <div id="alpha-slider">
      <div id="alpha-slider-gradient"></div>
      <div id="alpha-slider-track">
        <div id="alpha-slider-marker"></div>
      </div>
    </div>
  </x-box>
`;

  // @events
  //   change
  //   changestart
  //   changeend
  class XWheelColorPickerElement extends HTMLElement {
    static get observedAttributes() {
      return ["value"];
    }

    // @type
    //   string
    // @default
    //   "hsla(0, 0%, 100%, 1)"
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : "hsla(0, 0%, 100%, 1)";
    }
    set value(value) {
      this.setAttribute("value", value);
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      // Note that HSVA color model is used only internally
      this._h = 0;   // Hue (0 ~ 360)
      this._s = 0;   // Saturation (0 ~ 100)
      this._v = 100; // Value (0 ~ 100)
      this._a = 1;   // Alpha (0 ~ 1)

      this._isDraggingHuesatMarker = false;
      this._isDraggingValueSliderMarker = false;
      this._isDraggingAlphaSliderMarker = false;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.innerHTML = shadowHTML$3;

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#huesat-slider"].addEventListener("pointerdown", (event) => this._onHuesatSliderPointerDown(event));
      this["#value-slider"].addEventListener("pointerdown", (event) => this._onValueSliderPointerDown(event));
      this["#alpha-slider"].addEventListener("pointerdown", (event) => this._onAlphaSliderPointerDown(event));
    }

    async connectedCallback() {
      this._update();

      if (this["#huesat-image"].src === "") {
        this["#huesat-image"].src = await getColorWheelImageURL();
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "value") {
        this._onValueAttributeChange();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      this._updateHuesatMarker();
      this._updateValueSliderMarker();
      this._updateValueSliderBackground();
      this._updateAlphaSliderMarker();
      this._updateAlphaSliderBackground();
    }

    _updateHuesatMarker() {
      let h = this._h;
      let s = this._s;

      let wheelSize = 100;
      let angle = degToRad(h);
      let radius = (s / 100) * wheelSize/2;
      let centerPoint = {x: wheelSize/2, y: wheelSize/2};

      let x = ((wheelSize - (centerPoint.x + (radius * cos(angle)))) / wheelSize) * 100;
      let y = ((centerPoint.y - (radius * sin(angle))) / wheelSize) * 100;

      this["#huesat-marker"].style.left = x + "%";
      this["#huesat-marker"].style.top = y + "%";
    }

    _updateValueSliderMarker() {
      this["#value-slider-marker"].style.left = (100 - normalize(this._v, 0, 100, 2)) + "%";
    }

    _updateValueSliderBackground() {
      let gradientBackground = "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,1))";
      let solidBackground = serializeColor([this._h, this._s, 100, 1], "hsva", "hex");
      this["#value-slider"].style.background = `${gradientBackground}, ${solidBackground}`;
    }

    _updateAlphaSliderMarker() {
      this["#alpha-slider-marker"].style.left = normalize((1 - this._a) * 100, 0, 100, 2) + "%";
    }

    _updateAlphaSliderBackground() {
      let [r, g, b] = hsvToRgb(this._h, this._s, this._v).map($0 => round($0, 0));

      this["#alpha-slider-gradient"].style.background = `
      linear-gradient(to right, rgba(${r}, ${g}, ${b}, 1), rgba(${r}, ${g}, ${b}, 0))
    `;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onValueAttributeChange() {
      if (
        this._isDraggingHuesatMarker === false &&
        this._isDraggingValueSliderMarker === false &&
        this._isDraggingAlphaSliderMarker === false
      ) {
        let [h, s, v, a] = parseColor(this.value, "hsva");

        this._h = h;
        this._s = s;
        this._v = v;
        this._a = a;

        this._update();
      }
    }

    _onHuesatSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let pointerMoveListener, lostPointerCaptureListener;
      let wheelBounds = this["#huesat-slider"].getBoundingClientRect();

      this._isDraggingHuesatMarker = true;
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      this["#huesat-slider"].style.cursor = "default";
      this["#huesat-slider"].setPointerCapture(pointerDownEvent.pointerId);

      let onPointerMove = (clientX, clientY) => {
        let radius = wheelBounds.width / 2;
        let x = clientX - wheelBounds.left - radius;
        let y = clientY - wheelBounds.top - radius;
        let d = pow$2(x, 2) + pow$2(y, 2);
        let theta = atan2$1(y, x);

        if (d > pow$2(radius, 2)) {
          x = radius * cos(theta);
          y = radius * sin(theta);
          d = pow$2(x, 2) + pow$2(y, 2);
          theta = atan2$1(y, x);
        }

        this._h = round(((theta + PI$2) / (PI$2 * 2)) * 360, 3);
        this._s = round((sqrt$2(d) / radius) * 100, 3);

        this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");
        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));

        this._updateHuesatMarker();
        this._updateValueSliderBackground();
        this._updateAlphaSliderBackground();
      };

      onPointerMove(pointerDownEvent.clientX, pointerDownEvent.clientY);

      this["#huesat-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
      });

      this["#huesat-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = (event) => {
        this["#huesat-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#huesat-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this["#huesat-slider"].style.cursor = null;

        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
        this._isDraggingHuesatMarker = false;
      });
    }

    _onValueSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#value-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingValueSliderMarker = true;
      this["#value-slider"].style.cursor = "default";
      this["#value-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let v = 100 - ((clientX - trackBounds.x) / trackBounds.width) * 100;
        v = normalize(v, 0, 100, 2);

        if (v !== this._v) {
          this._v = v;
          this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");

          this._updateValueSliderMarker();
          this._updateAlphaSliderBackground();

          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#value-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#value-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#value-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#value-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this["#value-slider"].style.cursor = null;

        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
        this._isDraggingValueSliderMarker = false;
      });
    }

    _onAlphaSliderPointerDown(pointerDownEvent) {
      if (pointerDownEvent.buttons !== 1) {
        return;
      }

      let trackBounds = this["#alpha-slider-track"].getBoundingClientRect();
      let pointerMoveListener, lostPointerCaptureListener;

      this._isDraggingAlphaSliderMarker = true;
      this["#alpha-slider"].style.cursor = "default";
      this["#alpha-slider"].setPointerCapture(pointerDownEvent.pointerId);
      this.dispatchEvent(new CustomEvent("changestart", {bubbles: true}));

      let onPointerMove = (clientX) => {
        let a = 1 - ((clientX - trackBounds.x) / trackBounds.width);
        a = normalize(a, 0, 1, 2);

        if (a !== this._a) {
          this._a = a;
          this.value = serializeColor([this._h, this._s, this._v, this._a], "hsva", "hsla");
          this._updateAlphaSliderMarker();
          this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
        }
      };

      onPointerMove(pointerDownEvent.clientX);

      this["#alpha-slider"].addEventListener("pointermove", pointerMoveListener = (pointerMoveEvent) => {
        onPointerMove(pointerMoveEvent.clientX);
      });

      this["#alpha-slider"].addEventListener("lostpointercapture", lostPointerCaptureListener = () => {
        this["#alpha-slider"].removeEventListener("pointermove", pointerMoveListener);
        this["#alpha-slider"].removeEventListener("lostpointercapture", lostPointerCaptureListener);
        this["#alpha-slider"].style.cursor = null;

        this.dispatchEvent(new CustomEvent("changeend", {bubbles: true}));
        this._isDraggingAlphaSliderMarker = false;
      });
    }
  }
  customElements.define("x-wheelcolorpicker", XWheelColorPickerElement);

  // @copyright
  //   © 2016-2017 Jarosław Foksa

  // @info
  //   Retrieve the path to the currently loaded theme, defaulting to "vanilla.theme.css".
  // @type
  //   (void) => string
  let getThemePath = () => {
    let themeStyleElement = document.querySelector(`link[href*="/themes/"]`);
    let themePath = "node_modules/xel/themes/vanilla.css";

    if (themeStyleElement) {
      themePath = themeStyleElement.getAttribute("href");
    }

    return themePath;
  };

  // @info
  //   Retrieve the base name of the currently loaded theme, defaulting to "vanilla".
  // @type
  //   (void) => string
  let getThemeName = () => {
    let path  = getThemePath();
    let startIndex = path.lastIndexOf("/") + 1;
    let endIndex = path.length - 4;
    let theme = (endIndex > startIndex ? path.substring(startIndex, endIndex) : "vanilla");
    return theme;
  };

  let colorSchemesByTheme = {
    material: {},
    macos: {
      blue: "hsl(211, 96.7%, 52.9%)",
      green: "hsl(88, 35%, 46%)",
      red: "hsl(344, 65%, 45%)",
      purple: "hsl(290, 40%, 46%)",
      yellowgreen: "hsl(61, 28%, 45%)"
    },
    vanilla: {
      blue: "hsl(211, 86%, 57%)",
      green: "hsl(88, 35%, 46%)",
      red: "hsl(344, 65%, 45%)",
      purple: "hsl(290, 40%, 46%)",
      yellowgreen: "hsl(61, 28%, 45%)"
    },
  };

  let shadowTemplate$x = html`
  <template>
    <link rel="stylesheet" href="${getThemePath()}">

    <style>
      :host {
        width: 100%;
        height: 100%;
        display: block;
      }

      #main {
        position: relative;
        display: flex;
        flex-flow: row;
        width: 100%;
        height: 100%;
      }

      /**
       * Navigation
       */

      #sidebar {
        position: relative;
        width: 270px;
        overflow: auto;
        box-shadow: 0px 2px 1px -1px rgba(0,0,0,0.2),
                    0px 1px 1px 0px rgba(0,0,0,0.14),
                    0px 1px 3px 0px rgba(0,0,0,0.12);
        z-index: 100;
      }

      #sidebar #header {
        padding: 20px 0;
      }

      #sidebar #header + hr {
        margin-top: -1px;
      }

      #sidebar h1 {
        margin: 0px 22px 0px 104px;
        line-height: 1;
      }

      #sidebar #nav {
        margin-bottom: 20px;
        width: 100%;
      }

      #sidebar #nav .external-link-icon {
        margin: 0;
        width: 20px;
        height: 20px;
      }

      #sidebar #nav x-button {
        width: calc(100% + 60px);
        margin-left: -30px;
        padding: 8px 30px;
        --ripple-background: white;
      }

      #sidebar #nav x-button x-label {
        font-size: 15px;
      }

      #hide-sidebar-button {
        position: absolute;
        top: 18px;
        left: 11px;
        padding: 0;
        width: 32px;
        height: 32px;
        min-height: 32px;
      }

      #show-sidebar-button {
        position: absolute;
        top: 20px;
        left: 11px;
        z-index: 10;
        padding: 0;
        width: 32px;
        height: 32px;
        min-height: 32px;
      }

      #theme-section {
        padding: 10px 0px;
      }

      #theme-section #theme-heading {
        margin-top: 0;
      }

      #theme-section x-select {
        width: 100%;
      }

      #theme-section #theme-select {
        margin-bottom: 14px;
      }

      /**
       * Views
       */

      #views {
        display: block;
        width: 100%;
        height: 100%;
        min-width: 20px;
        min-height: 20px;
        position: relative;
        flex: 1;
      }

      #views > .view {
        display: block;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: auto;
      }
      #views > .view:not([selected]) {
        display: none !important;
      }

      #views > .view > article {
        padding: 0 70px;
        margin: 0 auto;
        max-width: 780px;
        box-sizing: border-box;
      }

      #views section {
        margin-bottom: 35px;
      }

      #views section[hidden] + hr,
      #views section[data-last-visible] + hr {
        display: none;
      }

      #views section h3,
      #views section h4,
      #views section h5 {
        position: relative;
      }

      /* "About" view */

      #views #about-view {
        color: white;
        width: 100%;
        height: 100vh;
        display: flex;
        align-items: center;
        padding: 0 100px;
        margin: 0;
        max-width: none;
        box-sizing: border-box;
      }

      #about-view h1 {
        font-size: 170px;
        font-weight: 700;
        line-height: 1.5;
        margin: 0 0 50px 0;
        padding: 0;
        line-height: 1;
      }
      @media screen and (max-width: 880px) {
        #about-view h1  {
          font-size: 120px;
        }
      }

      #about-view h2 {
        font-size: 27px;
        font-weight: 400;
        line-height: 1.05;
        color: rgba(255,255,255, 0.8);
        margin: 0 0 20px 0;
        text-transform: none;
      }

      #about-view h2 em {
        color: rgba(255,255,255, 0.95);
        font-style: normal;
        font-weight: 700;
      }

      /* "Setup" view */

      #views #setup-view h3 {
        margin-bottom: 0;
      }

      #views #setup-view h3 x-icon {
        width: 40px;
        height: auto;
        display: inline-block;
        vertical-align: middle;
      }

      #views #setup-view pre {
        display: block;
        white-space: pre;
        overflow: auto;
      }

      #views #setup-view dd {
        margin: 0 0 18px 0;
      }
      #views #setup-view dd:last-of-type {
        margin: 0;
      }

      /* "FAQ" view */

      #views #faq-view h4 {
        margin-top: 0;
      }

      /* "Resources" view */

      #views #resources-view ul {
        margin-bottom: 0;
        padding-left: 20px;
      }
    </style>

    <main id="main">
      <x-button id="show-sidebar-button" icon="menu" skin="textured">
        <x-icon name="menu"></x-icon>
      </x-button>

      <sidebar id="sidebar">
        <header id="header">
          <h1 id="logo">Xel</h1>

          <x-button id="hide-sidebar-button" skin="textured">
            <x-icon name="chevron-left"></x-icon>
          </x-button>
        </header>

        <hr/>

        <nav id="nav">
          <section>
            <a href="/">
              <x-button skin="nav">
                <x-icon name="info"></x-icon>
                <x-label>About</x-label>
              </x-button>
            </a>

            <a href="/setup">
              <x-button skin="nav">
                <x-icon name="build"></x-icon>
                <x-label>Setup</x-label>
              </x-button>
            </a>

            <a href="/faq">
              <x-button skin="nav">
                <x-icon name="question-answer"></x-icon>
                <x-label>FAQ</x-label>
              </x-button>
            </a>

            <a href="/resources">
              <x-button skin="nav">
                <x-icon name="book"></x-icon>
                <x-label>Resources</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <a href="https://github.com/jarek-foksa/xel" target="_blank">
              <x-button skin="nav">
                <x-icon name="code"></x-icon>
                <x-label>Source Code</x-label>
                <x-icon class="external-link-icon" name="exit-to-app"></x-icon>
              </x-button>
            </a>

            <a href="https://github.com/jarek-foksa/xel/issues" target="_blank">
              <x-button skin="nav">
                <x-icon name="bug-report"></x-icon>
                <x-label>Bugs</x-label>
                <x-icon class="external-link-icon" name="exit-to-app"></x-icon>
              </x-button>
            </a>

            <a href="https://github.com/jarek-foksa/xel/commits" target="_blank">
              <x-button skin="nav">
                <x-icon name="event"></x-icon>
                <x-label>Changelog</x-label>
                <x-icon class="external-link-icon" name="exit-to-app"></x-icon>
              </x-button>
            </a>
          </section>

          <hr/>

          <section id="theme-section">
            <div id="theme-subsection">
              <h3 id="theme-heading">Theme</h3>

              <x-select id="theme-select">
                <x-menu>
                  <x-menuitem value="macos">
                    <x-label>MacOS</x-label>
                  </x-menuitem>

                  <x-menuitem value="material" toggled>
                    <x-label>Material</x-label>
                  </x-menuitem>

                  <x-menuitem value="vanilla">
                    <x-label>Vanilla</x-label>
                  </x-menuitem>
                </x-menu>
              </x-select>
            </div>

            <div id="accent-color-subsection">
              <h3>Accent color</h3>

              <x-select id="accent-color-select">
                <x-menu id="accent-color-menu"></x-menu>
              </x-select>
            </div>
          </section>

          <hr/>

          <section>
            <h3>Primitives</h3>

            <a href="/elements/x-box">
              <x-button skin="nav">
                <x-label>x-box</x-label>
              </x-button>
            </a>

            <a href="/elements/x-card">
              <x-button skin="nav">
                <x-label>x-card</x-label>
              </x-button>
            </a>

            <a href="/elements/x-accordion">
              <x-button skin="nav">
                <x-label>x-accordion</x-label>
              </x-button>
            </a>

            <a href="/elements/x-icon">
              <x-button skin="nav">
                <x-label>x-icon</x-label>
              </x-button>
            </a>

            <a href="/elements/x-label">
              <x-button skin="nav">
                <x-label>x-label</x-label>
              </x-button>
            </a>

            <a href="/elements/x-shortcut">
              <x-button skin="nav">
                <x-label>x-shortcut</x-label>
              </x-button>
            </a>

            <a href="/elements/x-stepper">
              <x-button skin="nav">
                <x-label>x-stepper</x-label>
              </x-button>
            </a>

            <a href="/elements/x-swatch">
              <x-button skin="nav">
                <x-label>x-swatch</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Buttons</h3>

            <a href="/elements/x-button">
              <x-button skin="nav">
                <x-label>x-button</x-label>
              </x-button>
            </a>

            <a href="/elements/x-buttons">
              <x-button skin="nav">
                <x-label>x-buttons</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Tabs</h3>

            <a href="/elements/x-tabs">
              <x-button skin="nav">
                <x-label>x-tabs</x-label>
              </x-button>
            </a>

            <a href="/elements/x-doctabs">
              <x-button skin="nav">
                <x-label>x-doctabs</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Menus</h3>

            <a href="/elements/x-menu">
              <x-button skin="nav">
                <x-label>x-menu</x-label>
              </x-button>
            </a>

            <a href="/elements/x-menuitem">
              <x-button skin="nav">
                <x-label>x-menuitem</x-label>
              </x-button>
            </a>

            <a href="/elements/x-menubar">
              <x-button skin="nav">
                <x-label>x-menubar</x-label>
              </x-button>
            </a>

            <a href="/elements/x-contextmenu">
              <x-button skin="nav">
                <x-label>x-contextmenu</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Popups</h3>

            <a href="/elements/dialog">
              <x-button skin="nav">
                <x-label>dialog</x-label>
              </x-button>
            </a>

            <a href="/elements/x-popover">
              <x-button skin="nav">
                <x-label>x-popover</x-label>
              </x-button>
            </a>

            <a href="/elements/x-notification">
              <x-button skin="nav">
                <x-label>x-notification</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Forms</h3>

            <a href="/elements/x-checkbox">
              <x-button skin="nav">
                <x-label>x-checkbox</x-label>
              </x-button>
            </a>

            <a href="/elements/x-radio">
              <x-button skin="nav">
                <x-label>x-radio</x-label>
              </x-button>
            </a>

            <a href="/elements/x-switch">
              <x-button skin="nav">
                <x-label>x-switch</x-label>
              </x-button>
            </a>

            <a href="/elements/x-select">
              <x-button skin="nav">
                <x-label>x-select</x-label>
              </x-button>
            </a>

            <a href="/elements/x-colorselect">
              <x-button skin="nav">
                <x-label>x-colorselect</x-label>
              </x-button>
            </a>

            <a href="/elements/x-dateselect">
              <x-button skin="nav">
                <x-label>x-dateselect</x-label>
              </x-button>
            </a>

            <a href="/elements/x-input">
              <x-button skin="nav">
                <x-label>x-input</x-label>
              </x-button>
            </a>

            <a href="/elements/x-numberinput">
              <x-button skin="nav">
                <x-label>x-numberinput</x-label>
              </x-button>
            </a>

            <a href="/elements/x-taginput">
              <x-button skin="nav">
                <x-label>x-taginput</x-label>
              </x-button>
            </a>

            <a href="/elements/x-textarea">
              <x-button skin="nav">
                <x-label>x-textarea</x-label>
              </x-button>
            </a>

            <a href="/elements/x-slider">
              <x-button skin="nav">
                <x-label>x-slider</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Progress</h3>

            <a href="/elements/x-progressbar">
              <x-button skin="nav">
                <x-label>x-progressbar</x-label>
              </x-button>
            </a>

            <a href="/elements/x-throbber">
              <x-button skin="nav">
                <x-label>x-throbber</x-label>
              </x-button>
            </a>
          </section>
        </nav>
      </sidebar>

      <div id="views"></div>
    </main>
  </template>
`;

  class XelAppElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$x.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      window.addEventListener("load", (event) => this._onWindowLoad(event));
      window.addEventListener("popstate", (event) => this._onPopState(event));
      window.addEventListener("beforeunload", (event) => this._onWindowUnload(event));

      this._shadowRoot.addEventListener("click", (event) => this._onShadowRootClick(event));
      this["#hide-sidebar-button"].addEventListener("click", (event) => this._onHideNavButtonClick(event));
      this["#show-sidebar-button"].addEventListener("click", (event) => this._onShowNavButtonClick(event));
      this["#theme-select"].addEventListener("change", (event) => this._onThemeSelectChange(event));
      this["#accent-color-select"].addEventListener("change", (event) => this._onAccentColorSelectChange(event));
    }

    connectedCallback() {
      history.scrollRestoration = "manual";

      if (history.state === null) {
        history.replaceState(null, null, window.location.href);
      }

      this._updateNavButtons();
      this._updateViews();
      this._updateThemeSection();

      this._applyAccentColor();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async _onThemeSelectChange() {
      sessionStorage.setItem("theme", this["#theme-select"].value);
      await sleep(800);
      location.reload();
    }

    _onAccentColorSelectChange() {
      sessionStorage.setItem("accentColorName", this["#accent-color-select"].value);
      this._applyAccentColor();
    }

    _onWindowLoad() {
      let scrollTop = parseInt(sessionStorage.getItem("selectedViewScrollTop") || "0");
      let selectedView = this["#views"].querySelector(".view[selected]");

      if (selectedView) {
        selectedView.scrollTop = scrollTop;
      }
      else {
        sleep(100).then(() => {
          selectedView = this["#views"].querySelector(".view[selected]");

          if (selectedView) {
            selectedView.scrollTop = scrollTop;
          }
        });
      }
    }

    _onWindowUnload(event) {
      let selectedView = this["#views"].querySelector(".view[selected]");
      sessionStorage.setItem("selectedViewScrollTop", selectedView.scrollTop);
    }

    _onPopState(event) {
      this._updateNavButtons();
      this._updateViews();
    }

    _onShadowRootClick(event) {
      let {ctrlKey, shiftKey, metaKey, target} = event;

      if (ctrlKey === false && shiftKey === false && metaKey === false) {
        let anchor = target.closest("a");

        if (anchor) {
          let url = new URL(anchor.href);

          if (location.origin === url.origin) {
            event.preventDefault();

            if (location.pathname !== url.pathname) {
              history.pushState(null, null, anchor.href);

              this._updateNavButtons();
              this._updateViews();
            }
          }
        }
      }
    }

    _onHideNavButtonClick(event) {
      if (event.button === 0) {
        this._hideSidebar();
      }
    }

    _onShowNavButtonClick(event) {
      if (event.button === 0) {
        this._showSidebar();
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _showSidebar() {
      return new Promise(async (resolve) => {
        this["#sidebar"].hidden = false;

        let {width, height, marginLeft} = getComputedStyle(this["#sidebar"]);
        let fromMarginLeft = (marginLeft === "0px" && width !== "auto" ? `-${width}` : marginLeft);
        let toMarginLeft = "0px";

        let animation = this["#sidebar"].animate(
          {
            marginLeft: [fromMarginLeft, toMarginLeft]
          },
          {
            duration: 250,
            easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
          }
        );

        this["#sidebar"].style.marginLeft = "0";
        this._currentAnimation = animation;
      });
    }

    _hideSidebar() {
      return new Promise(async (resolve) => {
        this["#sidebar"].hidden = false;

        let {width, height, marginLeft} = getComputedStyle(this["#sidebar"]);
        let fromMarginLeft = (marginLeft === "0px" && width !== "auto" ? "0px" : marginLeft);
        let toMarginLeft = `-${width}`;

        let animation = this["#sidebar"].animate(
          {
            marginLeft: [fromMarginLeft, toMarginLeft]
          },
          {
            duration: 250,
            easing: "cubic-bezier(0.4, 0.0, 0.2, 1)",
          }
        );

        this["#sidebar"].style.marginLeft = toMarginLeft;
        this._currentAnimation = animation;

        await animation.finished;

        if (this._currentAnimation === animation) {
          this["#sidebar"].hidden = true;
        }
      });
    }

    _applyAccentColor() {
      let accentColorName = sessionStorage.getItem("accentColorName");

      if (accentColorName !== null) {
        let themeName = getThemeName();
        let accentColor = colorSchemesByTheme[themeName][accentColorName];

        if (!accentColor) {
          let names = Object.keys(colorSchemesByTheme[themeName]);

          if (names.length > 0) {
            accentColor = colorSchemesByTheme[themeName][names[0]];
          }
        }

        if (accentColor) {
          let [h, s, l] = parseColor(accentColor, "hsla");
          document.body.style.setProperty("--accent-color-h", h);
          document.body.style.setProperty("--accent-color-s", s + "%");
          document.body.style.setProperty("--accent-color-l", l + "%");
        }
      }
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Update selected nav button to match current location.
    _updateNavButtons() {
      for (let button of this["#nav"].querySelectorAll("x-button")) {
        let anchor = button.closest("a");

        if (anchor) {
          let url = new URL(anchor);

          if (url.origin === location.origin && url.pathname === location.pathname) {
            button.setAttribute("toggled", "");
          }
          else {
            button.removeAttribute("toggled");
          }
        }
      }
    }

    // @info
    //   Update displayed view to match current location
    async _updateViews() {
      let selectedView = this["#views"].querySelector(".view[selected]");

      if (!selectedView || selectedView.dataset.pathname !== location.pathname) {
        let view = this["#views"].querySelector(`[data-pathname="${location.pathname}"]`);

        // If the view does not exist, try to create it
        if (!view) {
          let url = "";

          if (location.pathname === "/") {
            url = "docs/about.html";
          }
          else if (location.pathname.startsWith("/elements/")) {
            url = "docs" + location.pathname.substring(9) + ".html";
          }
          else {
            url = "docs" + location.pathname + ".html";
          }

          let viewHTML = await readFile(url);
          view = html`${viewHTML}`;
          view.setAttribute("data-pathname", location.pathname);
          this["#views"].append(view);
        }

        if (location.pathname === "/") {
          document.querySelector("title").textContent = "Xel";
        }
        else {
          document.querySelector("title").textContent = "Xel - " + view.querySelector("h2").textContent;
        }

        // Toggle view
        {
          let view = this["#views"].querySelector(`[data-pathname="${location.pathname}"]`);
          let otherView = this["#views"].querySelector(`.view[selected]`);

          if (otherView) {
            if (otherView === view) {
              return;
            }
            else {
              otherView.removeAttribute("selected");
            }
          }

          view.setAttribute("selected", "");
        }

        // Hide theme-specific sections that don't match the current theme
        {
          let themeName = getThemeName();

          for (let section of view.querySelectorAll("section")) {
            if (section.hasAttribute("data-themes")) {
              if (section.getAttribute("data-themes").includes(themeName) === false) {
                section.hidden = true;
              }
            }
          }

          let visibleSections = view.querySelectorAll("section:not([hidden])");

          if (visibleSections.length > 0) {
            let lastVisibleSection = visibleSections[visibleSections.length-1];
            lastVisibleSection.setAttribute("data-last-visible", "");
          }
        }

        // Remove offscreen views
        {
          for (let view of [...this["#views"].children]) {
            if (view.hasAttribute("animating") === false && view.hasAttribute("selected") === false) {
              view.remove();
            }
          }
        }
      }
    }

    _updateThemeSection() {
      let themeName = getThemeName();

      // Update theme subsection
      {
        for (let item of this["#theme-select"].querySelectorAll("x-menuitem")) {
          if (item.getAttribute("value") === themeName) {
            item.setAttribute("toggled", "");
          }
          else {
            item.removeAttribute("toggled");
          }
        }
      }

      // Update accent color subsection
      {
        if (themeName === "material") {
          this["#accent-color-subsection"].hidden = true;
        }
        else {
          let accentColorName = sessionStorage.getItem("accentColorName");
          let supportedAccentColorNames = Object.keys(colorSchemesByTheme[themeName]);

          let itemsHTML = "";

          for (let [colorName, colorValue] of Object.entries(colorSchemesByTheme[themeName])) {
            itemsHTML += `
            <x-menuitem value="${colorName}" toggled>
              <x-swatch value="${colorValue}"></x-swatch>
              <x-label>${capitalize(colorName)}</x-label>
            </x-menuitem>
          `;
          }

          this["#accent-color-menu"].innerHTML = itemsHTML;

          if (accentColorName === null) {
            if (supportedAccentColorNames.length > 0) {
              accentColorName = supportedAccentColorNames[0];
              sessionStorage.setItem("accentColorName", accentColorName);
            }
          }

          if (supportedAccentColorNames.includes(accentColorName) === false) {
            if (supportedAccentColorNames.length > 0) {
              accentColorName = supportedAccentColorNames[0];
              sessionStorage.setItem("accentColorName", accentColorName);
            }
            else {
              accentColorName = null;
            }
          }

          for (let item of this["#accent-color-select"].querySelectorAll("x-menuitem")) {
            if (item.getAttribute("value") === accentColorName) {
              item.setAttribute("toggled", "");
            }
            else {
              item.removeAttribute("toggled");
            }
          }

          this["#accent-color-subsection"].hidden = false;
        }
      }
    }
  }

  if (document.documentElement.id === "xel-home-page") {
    customElements.define("xel-app", XelAppElement);
  }

  let shadowTemplate$y = html`
  <template>
    <style>
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
        background: white;
        padding: 14px;
        --selection-background: #B2D7FD;
      }

      ::selection {
        background: var(--selection-background);
      }

      #code {
        display: block;
        white-space: pre-wrap;
        overflow-x: auto;
        font-size: 13px;
        line-height: 18px;
        outline: none;
        background: none;
        padding: 0;
      }
    </style>

    <link id="prism-theme" rel="stylesheet">
    <code id="code" class="language-html"></code>
  </template>
`;

  class XelCodeViewElement extends HTMLElement {
    // @type
    //   string
    // @default
    //   ""
    get value() {
      return this._value;
    }
    set value(value) {
      this._value = value;
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$y.content, true));

      this._value = "";

      this._observer = new MutationObserver(() => this._update());
      this._observer.observe(this, {childList: true, attributes: false, characterData: true, subtree: true});

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      this["#prism-theme"].setAttribute("href", "node_modules/prismjs/themes/prism-coy.css");
      this._update();
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      this["#code"].textContent = this.textContent;

      if (this["#code"].textContent !== "") {
        Prism.highlightElement(this["#code"], true);
      }
    }
  }

  if (document.documentElement.id === "xel-home-page") {
    customElements.define("xel-codeview", XelCodeViewElement);
  }

  let counter = 0;

  let shadowTemplate$z = html`
  <template>
    <style>
      :host {
        display: block;
      }

      #code-view {
        margin-top: 25px;
      }
      :host([compact]) #code-view {
        max-height: 350px;
        overflow: scroll;
      }
    </style>

    <link rel="stylesheet" href="${getThemePath()}">

    <main>
      <div id="live-view"></div>
      <xel-codeview id="code-view"></xel-codeview>
    </main>
  </template>
`;

  class XelDemoElement extends HTMLElement {
    static get observedAttributes() {
      return ["name"];
    }

    // @info
    //   Compact demo has a scrollable code view with limited max height.
    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get compact() {
      return this.hasAttribute("compact");
    }
    set compact(compact) {
      compact ? this.setAttribute("compact", "") : this.removeAttribute("compact");
    }

    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate$z.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    connectedCallback() {
      let template = this.querySelector("template");

      if (!template) {
        return "";
      }

      let liveViewContent = document.importNode(template.content, true);
      let codeViewContent = liveViewContent.cloneNode(true);

      // Live view
      {

        this["#live-view"].append(liveViewContent);

        let scripts = this["#live-view"].querySelectorAll("script");

        if (scripts.length > 0) {
          window["shadowRoot" + counter] = this["#live-view"];

          for (let script of scripts) {
            let scriptText = "{" + replaceAll(script.textContent, "document", `window.shadowRoot${counter}`) + "}";
            eval(scriptText);
          }

          counter += 1;
        }
      }

      // Code view
      {
        let container = document.createElement("div");

        for (let child of codeViewContent.childNodes) {
          container.append(child.cloneNode(true));
        }

        // Remove dynamically added attributes
        for (let element of container.querySelectorAll("*")) {
          if (element.localName.startsWith("x-")) {
            for (let {name, value} of [...element.attributes]) {
              if (name === "tabindex" || name === "role" || name.startsWith("aria")) {
                element.removeAttribute(name);
              }
            }
          }
        }

        let textContent = container.innerHTML;

        // Simplify boolean attributes
        textContent = replaceAll(textContent, `=""`, "");
        textContent = replaceAll(textContent, "demo", "document");

        let lines = textContent.split("\n");

        // Remove leading and trailing empty lines
        {
          if (isDOMWhitespace(lines[0])) {
            lines.shift();
          }

          if (isDOMWhitespace(lines[lines.length - 1])) {
            lines.pop();
          }
        }

        // Remove excesive indentation
        {
          let minIndent = Infinity;

          for (let line of lines) {
            if (isDOMWhitespace(line) === false) {
              let indent = 0;

              for (let char of line) {
                if (char === " ") {
                  indent += 1;
                }
                else {
                  break;
                }
              }

              if (indent < minIndent) {
                minIndent = indent;
              }
            }
          }

          lines = lines.map(line => line.substring(minIndent));
        }

        this["#code-view"].textContent = lines.join("\n");
      }
    }

    attributeChangedCallback(name) {
      if (name === "name") {
        this._update();
      }
    }
  }

  if (document.documentElement.id === "xel-home-page") {
    customElements.define("xel-demo", XelDemoElement);
  }

}());
