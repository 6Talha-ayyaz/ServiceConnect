import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

const CATALOGUE: { name: string; slug: string; icon: string; subServices: string[] }[] = [
  { name: "Plumbing", slug: "plumbing", icon: "🔧", subServices: ["Leak repair", "Pipe installation", "Water tank cleaning", "Drain unclogging"] },
  { name: "Electrical", slug: "electrical", icon: "💡", subServices: ["Wiring repair", "Switch/socket installation", "Fan installation", "Circuit breaker fix"] },
  { name: "Carpentry", slug: "carpentry", icon: "🪚", subServices: ["Furniture repair", "Door/window fitting", "Custom furniture"] },
  { name: "AC & Refrigeration", slug: "ac-refrigeration", icon: "❄️", subServices: ["AC servicing", "AC gas refill", "Fridge repair"] },
  { name: "Home Cleaning", slug: "home-cleaning", icon: "🧹", subServices: ["Deep cleaning", "Sofa/carpet cleaning", "Kitchen cleaning"] },
  { name: "Painting", slug: "painting", icon: "🎨", subServices: ["Interior painting", "Exterior painting", "Texture/wall design"] },
  { name: "Appliance Repair", slug: "appliance-repair", icon: "🛠️", subServices: ["Washing machine repair", "Microwave repair", "Water dispenser repair"] },
  { name: "Pest Control", slug: "pest-control", icon: "🐜", subServices: ["General pest control", "Termite treatment", "Fumigation"] },
];

async function main() {
  for (const [i, cat] of CATALOGUE.entries()) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug, icon: cat.icon, displayOrder: i },
    });

    for (const subName of cat.subServices) {
      const existing = await prisma.subService.findFirst({ where: { categoryId: category.id, name: subName } });
      if (!existing) {
        await prisma.subService.create({
          data: { categoryId: category.id, name: subName, defaultPricing: "INSPECT_THEN_QUOTE" },
        });
      }
    }
  }

  const adminEmail = "admin@serviceconnect.local";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        fullName: "Platform Admin",
        phone: "+920000000000",
        email: adminEmail,
        passwordHash: await hashPassword("Admin!2026Strong"),
        role: "ADMIN",
        status: "ACTIVE",
        phoneVerifiedAt: new Date(),
      },
    });
    console.log(`Seeded admin user: ${adminEmail} / Admin!2026Strong`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
