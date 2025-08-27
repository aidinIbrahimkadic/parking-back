export function setPaginationLinks(req, res, page, pageSize, total) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const base = `${req.protocol}://${req.get("host")}${req.path}`;
  const qp = new URLSearchParams(req.query);

  const links = [];
  function push(p, rel) {
    qp.set("page", p);
    qp.set("pageSize", pageSize);
    links.push(`<${base}?${qp.toString()}>; rel="${rel}"`);
  }
  push(page, "self");
  if (page > 1) {
    push(1, "first");
    push(page - 1, "prev");
  }
  if (page < maxPage) {
    push(page + 1, "next");
    push(maxPage, "last");
  }

  res.setHeader("Link", links.join(", "));
}
