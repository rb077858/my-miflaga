// שרת התחברות מדומה לבדיקות בלבד. מחקה את /api/userinfo של Reem.bi.
// השרת האמיתי משתמש בו רק כש-DEV_MODE=1 ו-SSO_ORIGIN מוגדרים (לא בפרודקשן).
import { createServer } from 'node:http';

export const USERS = {
  'tok-alice-0000000000': { id: 'u-alice', email: 'alice@example.com', name: 'אליס', avatar: null },
  'tok-bob-00000000000': { id: 'u-bob', email: 'bob@example.com', name: 'בוב', avatar: null },
  'tok-admin-000000000': { id: 'u-admin', email: 'rb077858@gmail.com', name: 'מנהל', avatar: null },
  'tok-carol-000000000': { id: 'u-carol', email: 'carol@example.com', name: 'קרול', avatar: null },
};

export function startMockSso(port = 8788) {
  let down = false;
  const server = createServer((req, res) => {
    if (req.url === '/__down') { down = true; res.end('ok'); return; }
    if (req.url === '/__up') { down = false; res.end('ok'); return; }
    if (req.url.startsWith('/api/userinfo')) {
      if (down) { res.writeHead(502); res.end('{}'); return; }
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
      const user = USERS[token];
      if (!user) { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'invalid_token' })); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ user, access: { status: 'active', plan: null, features: {} } }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

// SDK מדומה לדפדפן: אותו ממשק כמו https://login.reembir.com/sdk.js, עם טוקן מ-localStorage.
export const FAKE_SDK = `(function(){
  function C(o){ this.clientId=o.clientId; this._l=[]; var t=null; try{t=localStorage.getItem('mock:token');}catch(e){}
    this._token=t; this.error=null; var self=this;
    this.user = undefined;
    this.ready = fetch('/__mock_user?token='+encodeURIComponent(t||'')).then(function(r){return r.ok?r.json():null}).catch(function(){return null}).then(function(u){ self.user=u; self._l.forEach(function(f){f(u)}); return u; });
  }
  C.prototype.onChange=function(cb){ this._l.push(cb); if(this.user!==undefined) cb(this.user); var s=this; return function(){ s._l=s._l.filter(function(x){return x!==cb}) } };
  C.prototype.login=function(){ localStorage.setItem('mock:login-called','1'); };
  C.prototype.logout=function(){ localStorage.removeItem('mock:token'); this._token=null; this.user=null; var u=null; this._l.forEach(function(f){f(u)}); return Promise.resolve(); };
  C.prototype.getToken=function(){ return this._token; };
  C.prototype.accountUrl=function(){ return 'https://login.reembir.com/'; };
  window.ReemAuth={ init:function(o){ return new C(o); } };
})();`;
