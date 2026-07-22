import { Router } from "express";
import { prisma } from "../prisma";

export const catalogueRouter = Router();

catalogueRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { displayOrder: "asc" },
      include: { subServices: { where: { active: true } } },
    });
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});
