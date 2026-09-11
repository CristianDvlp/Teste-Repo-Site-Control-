import {sessao,responderErro} from '../lib/conta.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method !== 'GET') return res.status(405).json({erro:'Método não permitido.'});
 try {
  const u=await sessao(req);
  return res.status(200).json({logado:true,id:u.id,usuario:u.usuario,admin:u.admin,email:u.email,emailConfirmado:u.email_confirmado});
 } catch(erro) { return responderErro(res,erro); }
}
