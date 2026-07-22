import { prisma } from "../prisma";
import { Errors } from "../utils/errors";
import { PricingModel } from "@prisma/client";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listAllCategories() {
  return prisma.category.findMany({
    orderBy: { displayOrder: "asc" },
    include: { subServices: true },
  });
}

interface CategoryInput {
  name: string;
  icon?: string;
  description?: string;
  displayOrder?: number;
}

export async function createCategory(input: CategoryInput) {
  const slug = slugify(input.name);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) throw Errors.conflict("A category with this name already exists.");

  return prisma.category.create({
    data: {
      name: input.name,
      slug,
      icon: input.icon,
      description: input.description,
      displayOrder: input.displayOrder ?? 0,
    },
  });
}

export async function updateCategory(id: string, input: Partial<CategoryInput> & { active?: boolean }) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw Errors.notFound("Category not found.");

  return prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      icon: input.icon,
      description: input.description,
      displayOrder: input.displayOrder,
      active: input.active,
    },
  });
}

// FR-3.6: deactivating hides it from new requests but does not affect historical jobs.
export async function deactivateCategory(id: string) {
  return updateCategory(id, { active: false });
}

interface SubServiceInput {
  categoryId: string;
  name: string;
  description?: string;
  defaultPricing: PricingModel;
  suggestedMinPrice?: number;
  suggestedMaxPrice?: number;
  durationMinutes?: number;
}

export async function createSubService(input: SubServiceInput) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw Errors.notFound("Category not found.");

  return prisma.subService.create({
    data: {
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      defaultPricing: input.defaultPricing,
      suggestedMinPrice: input.suggestedMinPrice,
      suggestedMaxPrice: input.suggestedMaxPrice,
      durationMinutes: input.durationMinutes,
    },
  });
}

export async function updateSubService(id: string, input: Partial<SubServiceInput> & { active?: boolean }) {
  const subService = await prisma.subService.findUnique({ where: { id } });
  if (!subService) throw Errors.notFound("Sub-service not found.");

  return prisma.subService.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      defaultPricing: input.defaultPricing,
      suggestedMinPrice: input.suggestedMinPrice,
      suggestedMaxPrice: input.suggestedMaxPrice,
      durationMinutes: input.durationMinutes,
      active: input.active,
    },
  });
}

export async function deactivateSubService(id: string) {
  return updateSubService(id, { active: false });
}
