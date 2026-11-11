/* Zündung – Konto: Anbindung an die Server-API unter /api.
   Läuft das Spiel ohne Server (Doppelklick auf index.html oder rein statisches Hosting),
   bleibt "available" false und alle Konto-Elemente werden ausgeblendet. */
(function (ZU) {
  'use strict';

  var listeners = [];

  function call(method, url, body) {
    if (typeof fetch !== 'function') return Promise.resolve({ status: 0, data: null });
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        return { status: response.status, data: data };
      });
    }).catch(function () {
      return { status: 0, data: null };
    });
  }

  function localStats() {
    var profile = ZU.Profile.load();
    return { runs: profile.runs, wins: profile.wins, best: profile.best, bestAct: profile.bestAct };
  }

  /* Der Server ist nach der Anmeldung maßgeblich: seine Zahlen ersetzen die lokalen. */
  function adopt(data) {
    A.user = data.user;
    A.stats = data.stats;
    var profile = ZU.Profile.load();
    profile.runs = data.stats.runs;
    profile.wins = data.stats.wins;
    profile.best = data.stats.best;
    profile.bestAct = data.stats.bestAct;
    ZU.Profile.save(profile);
    if (ZU.game) ZU.game.profile = profile;
    emit();
  }

  function emit() {
    listeners.slice().forEach(function (fn) { fn(); });
  }

  function result(response, onOk) {
    if (response.status >= 200 && response.status < 300 && response.data) {
      if (onOk) onOk(response.data);
      return { ok: true };
    }
    return { ok: false, error: response.data && response.data.error ? response.data.error : response.status ? 'server' : 'offline' };
  }

  var A = {
    available: false,
    user: null,
    stats: null,

    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        var index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      };
    },

    init: function () {
      if (location.protocol === 'file:') return Promise.resolve();
      return call('GET', 'api/me').then(function (response) {
        if (response.status === 200 && response.data && response.data.user) {
          A.available = true;
          adopt(response.data);
        } else if (response.status === 401 && response.data && response.data.error === 'auth') {
          A.available = true;
          emit();
        }
      });
    },

    register: function (username, password, email) {
      return call('POST', 'api/register', { username: username, password: password, email: email, local: localStats() })
        .then(function (response) { return result(response, adopt); });
    },

    login: function (username, password) {
      return call('POST', 'api/login', { username: username, password: password, local: localStats() })
        .then(function (response) { return result(response, adopt); });
    },

    logout: function () {
      return call('POST', 'api/logout', {}).then(function (response) {
        A.user = null;
        A.stats = null;
        emit();
        return result(response);
      });
    },

    remove: function (password) {
      return call('POST', 'api/account/delete', { password: password }).then(function (response) {
        return result(response, function () {
          A.user = null;
          A.stats = null;
          emit();
        });
      });
    },

    requestReset: function (email) {
      return call('POST', 'api/reset/request', { email: email }).then(function (response) { return result(response); });
    },

    confirmReset: function (token, password) {
      return call('POST', 'api/reset/confirm', { token: token, password: password })
        .then(function (response) { return result(response, adopt); });
    },

    /* Meldet einen beendeten Run; ohne Anmeldung passiert nichts. */
    reportRun: function (info) {
      if (!A.user) return Promise.resolve();
      return call('POST', 'api/run', info).then(function (response) {
        if (response.status === 200 && response.data) adopt(response.data);
        else if (response.status === 401) { A.user = null; A.stats = null; emit(); }
      });
    }
  };

  ZU.account = A;
})(window.ZU = window.ZU || {});
