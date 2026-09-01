export default function handler(req, res) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return res.status(500).json({
      erro: "DATABASE_URL não encontrada"
    });
  }

  try {
    const url = new URL(connectionString);

    return res.status(200).json({
      host: url.hostname,
      banco: url.pathname.replace("/", ""),
      usuario: url.username
    });
  } catch (erro) {
    return res.status(500).json({
      erro: "DATABASE_URL inválida"
    });
  }
}