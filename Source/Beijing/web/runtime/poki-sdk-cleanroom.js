/**
 * Clean-Room Offline Poki SDK Compatibility Interface
 *
 * Original implementation providing the surface contract expected by Unity WebGL
 * PokiUnitySDK / UnityLoader bridges without any Poki proprietary code,
 * remote ad networks, analytics beacons, or tracking cookies.
 */
(function (globalScope) {
    'use strict';

    var state = {
        initialized: false,
        gameplayActive: false,
        loadingProgress: 0
    };

    function resolvedVoid() {
        return Promise.resolve();
    }

    function resolvedFalse() {
        return Promise.resolve(false);
    }

    globalScope.PokiSDK = {
        init: function () {
            state.initialized = true;
            return resolvedVoid();
        },
        initWithVideoHB: function () {
            state.initialized = true;
            return resolvedVoid();
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
        displayAd: function () {},
        destroyAd: function () {},
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
            globalScope.unityGame.SendMessage(gameObjectName, 'ready');
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
