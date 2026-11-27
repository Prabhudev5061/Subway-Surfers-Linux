/**
 * Clean-Room Offline Poki SDK Compatibility Interface (Zurich)
 *
 * Implements the PokiUnitySDK bridge contract offline in ad-disabled mode
 * without remote ad networks, analytics beacons, or promotional popups.
 */
(function (globalScope) {
    'use strict';

    var state = {
        initialized: false,
        gameplayActive: false,
        loadingProgress: 0,
        adBlocked: true
    };

    function resolvedVoid() {
        return Promise.resolve();
    }

    function resolvedFalse() {
        return Promise.resolve(false);
    }

    function rejectedAdsDisabled() {
        return Promise.reject(new Error('Promotional ads disabled in offline desktop build'));
    }

    globalScope.pokiAdBlock = true;
    globalScope.pokiReady = false;

    globalScope.PokiSDK = {
        init: function () {
            state.initialized = false;
            state.adBlocked = true;
            globalScope.pokiAdBlock = true;
            globalScope.pokiReady = false;
            return rejectedAdsDisabled();
        },
        initWithVideoHB: function () {
            state.initialized = false;
            state.adBlocked = true;
            globalScope.pokiAdBlock = true;
            globalScope.pokiReady = false;
            return rejectedAdsDisabled();
        },
        setDebug: function () {},
        gameLoadingStart: function () { state.loadingProgress = 0; },
        gameLoadingProgress: function (data) {
            if (data && typeof data.percentageDone === 'number') {
                state.loadingProgress = data.percentageDone;
            }
        },
        gameLoadingFinished: function () { state.loadingProgress = 1; },
        gameInteractive: function () {},
        gameplayStart: function () { state.gameplayActive = true; },
        gameplayStop: function () { state.gameplayActive = false; },
        roundStart: function () {},
        roundEnd: function () {},
        commercialBreak: function () { return resolvedVoid(); },
        rewardedBreak: function () { return resolvedFalse(); },
        displayAd: function (container) {
            if (container && container.style) {
                container.style.display = 'none';
                container.style.top = '-9999px';
                container.style.left = '-9999px';
                if (container.parentNode) {
                    try { container.parentNode.removeChild(container); } catch (e) {}
                }
            }
        },
        destroyAd: function (container) {
            if (container && container.parentNode) {
                try { container.parentNode.removeChild(container); } catch (e) {}
            }
        },
        disableProgrammatic: function () {},
        muteAd: function () {},
        happyTime: function () {},
        setPlayerAge: function () {},
        togglePlayerAdvertisingConsent: function () {},
        toggleNonPersonalized: function () {},
        setConsentString: function () {},
        customEvent: function () {},
        logError: function () {},
        sendHighscore: function () {},
        setDebugTouchOverlayController: function () {},
        getLeaderboard: function () { return Promise.resolve({}); }
    };

    globalScope.initPokiBridge = function (gameObjectName) {
        globalScope.pokiBridge = gameObjectName;
        globalScope.pokiAdBlock = true;
        globalScope.pokiReady = false;
        globalScope.commercialBreak = function () {
            globalScope.PokiSDK.commercialBreak().then(function () {
                if (globalScope.unityGame && typeof globalScope.unityGame.SendMessage === 'function') {
                    globalScope.unityGame.SendMessage(gameObjectName, 'commercialBreakCompleted');
                }
            });
        };
        globalScope.rewardedBreak = function () {
            globalScope.PokiSDK.rewardedBreak().then(function (ok) {
                if (globalScope.unityGame && typeof globalScope.unityGame.SendMessage === 'function') {
                    globalScope.unityGame.SendMessage(gameObjectName, 'rewardedBreakCompleted', String(ok));
                }
            });
        };
        if (globalScope.unityGame && typeof globalScope.unityGame.SendMessage === 'function') {
            globalScope.unityGame.SendMessage(gameObjectName, 'adblock');
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
