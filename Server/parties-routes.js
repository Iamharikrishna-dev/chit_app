/**
 * Party Master routes — paste into server.js, after your auth routes and
 * before app.listen(...). Requires `pool`, `requireAuth`, and `asyncRoute`
 * to already be defined earlier in the file, plus `requireScreenPermission`
 * imported from ./permissions.js:
 *
 *   const { requireScreenPermission } = require("./permissions");
 *
 * Also requires `app.locals.pool = pool;` to be set once near the top of
 * server.js, since requireScreenPermission looks up the user's live
 * screen_overrides from the database on each request.
 *
 * Permission model on this screen ("party_master"):
 *   - GET     -> any authenticated user can view (matches viewer's read-only access)
 *   - POST    -> requires canAdd    (super_admin by default)
 *   - PUT     -> requires canEdit   (super_admin, admin by default — or any
 *                user granted a "party_master.canEdit" override)
 *   - DELETE  -> requires canDelete (super_admin by default)
 */

// --- Helper: fetch all parties with their members attached ---
async function fetchAllParties() {
  const partiesResult = await pool.query(
    "SELECT * FROM parties ORDER BY id ASC"
  );
  const membersResult = await pool.query(
    "SELECT * FROM party_members ORDER BY id ASC"
  );

  const membersByParty = {};
  membersResult.rows.forEach((m) => {
    if (!membersByParty[m.party_id]) membersByParty[m.party_id] = [];
    membersByParty[m.party_id].push({
      name: m.name,
      role: m.role,
      phone: m.phone,
      chitShare: Number(m.chit_share) || 0,
    });
  });

  return partiesResult.rows.map((p) => ({
    id: p.id,
    name: p.name,
    relation: p.relation,
    address: p.address,
    city: p.city,
    phone: p.phone,
    chitValue: Number(p.chit_value),
    status: p.status,
    members: membersByParty[p.id] || [
      { name: p.name, role: "Primary Subscriber", phone: p.phone, chitShare: Number(p.chit_value) || 0 },
    ],
  }));
}

// --- GET /api/parties — list all parties. Any authenticated user (view-only for viewers). ---
app.get(
  "/api/parties",
  requireAuth,
  asyncRoute(async (req, res) => {
    const parties = await fetchAllParties();
    res.json(parties);
  })
);

// --- POST /api/parties — create a new party (+ its members). Requires canAdd. ---
app.post(
  "/api/parties",
  requireAuth,
  requireScreenPermission("party_master", "canAdd"),
  asyncRoute(async (req, res) => {
    const { name, relation, address, city, phone, chitValue, status, members } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const partyResult = await client.query(
        `INSERT INTO parties (name, relation, address, city, phone, chit_value, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [name.trim(), relation || null, address || null, city || null, phone || null, Number(chitValue) || 0, status || "Active"]
      );
      const partyId = partyResult.rows[0].id;

      const memberList =
        Array.isArray(members) && members.length
          ? members
          : [{ name, role: "Primary Subscriber", phone, chitShare: Number(chitValue) || 0 }];

      for (const m of memberList) {
        if (!m.name || !m.name.trim()) continue;
        await client.query(
          `INSERT INTO party_members (party_id, name, role, phone, chit_share)
           VALUES ($1, $2, $3, $4, $5)`,
          [partyId, m.name.trim(), m.role || null, m.phone || null, Number(m.chitShare) || 0]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ id: partyId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

// --- PUT /api/parties/:id — update a party (+ replace its members). Requires canEdit. ---
app.put(
  "/api/parties/:id",
  requireAuth,
  requireScreenPermission("party_master", "canEdit"),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const { name, relation, address, city, phone, chitValue, status, members } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updateResult = await client.query(
        `UPDATE parties
         SET name = $1, relation = $2, address = $3, city = $4, phone = $5,
             chit_value = $6, status = $7, updated_at = now()
         WHERE id = $8
         RETURNING id`,
        [name.trim(), relation || null, address || null, city || null, phone || null, Number(chitValue) || 0, status || "Active", id]
      );

      if (updateResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Party not found." });
      }

      // Replace members: simplest correct approach — delete old, insert new
      await client.query("DELETE FROM party_members WHERE party_id = $1", [id]);

      const memberList =
        Array.isArray(members) && members.length
          ? members
          : [{ name, role: "Primary Subscriber", phone, chitShare: Number(chitValue) || 0 }];

      for (const m of memberList) {
        if (!m.name || !m.name.trim()) continue;
        await client.query(
          `INSERT INTO party_members (party_id, name, role, phone, chit_share)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, m.name.trim(), m.role || null, m.phone || null, Number(m.chitShare) || 0]
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

// --- DELETE /api/parties/:id — Requires canDelete. ---
app.delete(
  "/api/parties/:id",
  requireAuth,
  requireScreenPermission("party_master", "canDelete"),
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM parties WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Party not found." });
    }
    // party_members rows are removed automatically via ON DELETE CASCADE
    res.json({ ok: true });
  })
);