export const health = (_req, res) => res.json({ ok: true });

export const apiUrl = (req, res) => {
  const url = new URL(`${req.protocol}://${req.get("host")}/api/v1/parkings`);
  for (const [k, v] of Object.entries(req.query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  }
  res.json({ url: url.toString() });
};
