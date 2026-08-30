export default async function handler(req, res) {
  res.setHeader(
    "Set-Cookie",
    "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure"
  );

  return res.status(200).json({
    mensagem: "Logout feito com sucesso"
  });
}