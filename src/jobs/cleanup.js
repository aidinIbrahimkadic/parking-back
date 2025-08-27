import { Op } from "sequelize";
import { ParkingSnapshot } from "../models/ParkingSnapshot.js";

export async function cleanupSnapshots(retentionMonths = 12) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);

  const n = await ParkingSnapshot.destroy({
    where: { createdAt: { [Op.lt]: cutoff } },
  });
  return { deleted: n, cutoff: cutoff.toISOString() };
}
