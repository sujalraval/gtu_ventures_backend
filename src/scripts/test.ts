import prisma from '../lib/prisma';
prisma.webStartup.findMany().then(r => {
  console.log(JSON.stringify(r));
  process.exit(0);
});
