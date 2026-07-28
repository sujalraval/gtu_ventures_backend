import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';


const prismaClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined in .env file');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

const basePrisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Helper to check if a model has the 'deletedAt' field in Prisma schema dynamically
const hasDeletedAt = (modelName: string): boolean => {
  const model = Prisma.dmmf.datamodel.models.find(
    (m) => m.name.toLowerCase() === modelName.toLowerCase()
  );
  return model?.fields.some((f) => f.name === 'deletedAt') ?? false;
};

// Helper to recursively cascade soft-deletes on child relations configured with onDelete: Cascade
async function performCascadeSoftDelete(tx: any, modelName: string, whereClause: any, deletedAtValue: Date) {
  const parentModel = Prisma.dmmf.datamodel.models.find(
    (m) => m.name.toLowerCase() === modelName.toLowerCase()
  );
  if (!parentModel) return;

  const idField = parentModel.fields.find((f) => f.isId)?.name || 'id';

  // Retrieve records to get their primary keys
  const records = await tx[modelName].findMany({
    where: whereClause,
    select: { [idField]: true },
  });

  if (records.length === 0) return;
  const parentIds = records.map((r: any) => r[idField]);

  // Find all models in DMMF that have relations referencing parentModel with onDelete: Cascade
  for (const model of Prisma.dmmf.datamodel.models) {
    for (const field of model.fields) {
      if (
        field.relationName &&
        field.type.toLowerCase() === modelName.toLowerCase() &&
        field.relationOnDelete === 'Cascade'
      ) {
        const foreignKeyField = field.relationFromFields?.[0];
        if (foreignKeyField && hasDeletedAt(model.name)) {
          const childWhere = { [foreignKeyField]: { in: parentIds } };

          // Perform recursive soft-delete on matching active child rows
          await tx[model.name].updateMany({
            where: {
              ...childWhere,
              deletedAt: null,
            },
            data: { deletedAt: deletedAtValue },
          });

          // Cascade deeper
          await performCascadeSoftDelete(tx, model.name, childWhere, deletedAtValue);
        }
      }
    }
  }
}

// Read schema.prisma to parse which fields are list types, since Prisma DMMF is stripped down in runtime
const listRelationsMap = new Map<string, Set<string>>(); // "modelname" -> Set of field names that are lists

try {
  const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
  if (fs.existsSync(schemaPath)) {
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    let currentModel: string | null = null;
    const lines = schemaContent.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('model ')) {
        const parts = line.split(/\s+/);
        currentModel = parts[1];
        if (currentModel) {
          listRelationsMap.set(currentModel.toLowerCase(), new Set<string>());
        }
      } else if (line.startsWith('}')) {
        currentModel = null;
      } else if (currentModel && line.length > 0 && !line.startsWith('//') && !line.startsWith('@@')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const fieldName = parts[0];
          const fieldType = parts[1];
          if (fieldType.endsWith('[]')) {
            listRelationsMap.get(currentModel.toLowerCase())?.add(fieldName.toLowerCase());
          }
        }
      }
    }
  }
} catch (err) {
  console.error('Failed to parse schema.prisma for list relations:', err);
}

// Helper to check relation details (target model and if it is a list relation)
const getRelationDetails = (parentModelName: string, relationName: string) => {
  const model = Prisma.dmmf.datamodel.models.find(
    (m) => m.name.toLowerCase() === parentModelName.toLowerCase()
  );
  const field = model?.fields.find((f) => f.name === relationName);
  if (!field || !field.relationName) return null;
  
  const isList = listRelationsMap.get(parentModelName.toLowerCase())?.has(relationName.toLowerCase()) ?? false;
  return {
    targetModel: field.type,
    isList,
  };
};


// Helper function to recursively apply soft delete filters on relations
function applySoftDelete(args: any, modelName: string, isList: boolean = true) {
  if (!args) return;

  if (isList) {
    if (args.where) {
      if (hasDeletedAt(modelName) && !('deletedAt' in args.where)) {
        args.where.deletedAt = null;
      }
    } else if (hasDeletedAt(modelName)) {
      args.where = { deletedAt: null };
    }
  }

  // Handle nested include relations
  if (args.include) {
    for (const key of Object.keys(args.include)) {
      const details = getRelationDetails(modelName, key);
      if (!details) continue;

      if (args.include[key] === true) {
        if (hasDeletedAt(details.targetModel) && details.isList) {
          args.include[key] = { where: { deletedAt: null } };
        }
      } else if (typeof args.include[key] === 'object') {
        applySoftDelete(args.include[key], details.targetModel, details.isList);
      }
    }
  }

  // Handle nested select relations
  if (args.select) {
    for (const key of Object.keys(args.select)) {
      const details = getRelationDetails(modelName, key);
      if (!details) continue;

      if (typeof args.select[key] === 'object') {
        applySoftDelete(args.select[key], details.targetModel, details.isList);
      }
    }
  }
}


const prisma = (basePrisma.$extends({
  query: {
    $allModels: {
      async findUnique({ model, args }) {
        if (!hasDeletedAt(model) || (args.where && 'deletedAt' in args.where)) {
          return (basePrisma as any)[model].findUnique(args);
        }
        const newArgs = {
          ...args,
          where: {
            ...args.where,
            deletedAt: null,
          },
        };
        applySoftDelete(newArgs, model);
        return (basePrisma as any)[model].findFirst(newArgs);
      },
      async findUniqueOrThrow({ model, args }) {
        if (!hasDeletedAt(model) || (args.where && 'deletedAt' in args.where)) {
          return (basePrisma as any)[model].findUniqueOrThrow(args);
        }
        const newArgs = {
          ...args,
          where: {
            ...args.where,
            deletedAt: null,
          },
        };
        applySoftDelete(newArgs, model);
        return (basePrisma as any)[model].findFirstOrThrow(newArgs);
      },
      async findFirst({ model, args, query }) {
        if (!hasDeletedAt(model) || (args.where && 'deletedAt' in args.where)) {
          return query(args);
        }
        args.where = { ...args.where, deletedAt: null };
        applySoftDelete(args, model);
        return query(args);
      },
      async findFirstOrThrow({ model, args, query }) {
        if (!hasDeletedAt(model) || (args.where && 'deletedAt' in args.where)) {
          return query(args);
        }
        args.where = { ...args.where, deletedAt: null };
        applySoftDelete(args, model);
        return query(args);
      },
      async findMany({ model, args, query }) {
        if (!hasDeletedAt(model) || (args.where && 'deletedAt' in args.where)) {
          return query(args);
        }
        args.where = { ...args.where, deletedAt: null };
        applySoftDelete(args, model);
        return query(args);
      },
      async count({ model, args, query }) {
        if (!hasDeletedAt(model) || (args.where && 'deletedAt' in args.where)) {
          return query(args);
        }
        args.where = { ...args.where, deletedAt: null };
        applySoftDelete(args, model);
        return query(args);
      },
      async delete({ model, args }) {
        if (!hasDeletedAt(model)) {
          return (basePrisma as any)[model].delete(args);
        }
        return basePrisma.$transaction(async (tx) => {
          const deletedAtValue = new Date();
          await performCascadeSoftDelete(tx, model, args.where, deletedAtValue);
          return (tx as any)[model].update({
            where: args.where,
            data: { deletedAt: deletedAtValue },
          });
        });
      },
      async deleteMany({ model, args }) {
        if (!hasDeletedAt(model)) {
          return (basePrisma as any)[model].deleteMany(args);
        }
        return basePrisma.$transaction(async (tx) => {
          const deletedAtValue = new Date();
          await performCascadeSoftDelete(tx, model, args.where, deletedAtValue);
          return (tx as any)[model].updateMany({
            where: args.where,
            data: { deletedAt: deletedAtValue },
          });
        });
      },
    },
  },
})) as unknown as typeof basePrisma;

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;


