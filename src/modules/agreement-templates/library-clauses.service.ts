import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';

export class LibraryClausesService {
  /**
   * Retrieves all clauses in the library.
   */
  static async getAll() {
    return await prisma.libraryClause.findMany({
      orderBy: { title: 'asc' }
    });
  }

  /**
   * Retrieves a single library clause by ID.
   */
  static async getById(id: string) {
    const clause = await prisma.libraryClause.findUnique({
      where: { id }
    });
    if (!clause) throw new NotFoundError('Library clause not found');
    return clause;
  }

  /**
   * Adds a new clause to the global library.
   */
  static async create(data: any) {
    if (data.isDefault && data.category) {
      // Unset previous default in this category
      await prisma.libraryClause.updateMany({
        where: { category: data.category, isDefault: true },
        data: { isDefault: false }
      });
    }

    return await prisma.libraryClause.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags || [],
        isOptional: data.isOptional ?? false,
        isDefault: data.isDefault ?? false,
        version: 1
      }
    });
  }

  /**
   * Updates a library clause.
   */
  static async update(id: string, data: any) {
    await this.getById(id);

    if (data.isDefault && data.category) {
      // Unset previous default in this category
      await prisma.libraryClause.updateMany({
        where: { category: data.category, isDefault: true, NOT: { id } },
        data: { isDefault: false }
      });
    }

    return await prisma.libraryClause.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags,
        isOptional: data.isOptional,
        isDefault: data.isDefault,
        version: { increment: 1 }
      }
    });
  }

  /**
   * Sets a specific clause as the default for its category.
   */
  static async setDefault(id: string) {
    const clause = await this.getById(id);
    if (!clause.category) return clause;

    // Unset all other defaults in same category
    await prisma.libraryClause.updateMany({
      where: { category: clause.category, isDefault: true, NOT: { id } },
      data: { isDefault: false }
    });

    // Set this one as default
    return await prisma.libraryClause.update({
      where: { id },
      data: { isDefault: true }
    });
  }

  /**
   * Gets the default clause for a specific category.
   */
  static async getDefaultByCategory(category: string) {
    return await prisma.libraryClause.findFirst({
      where: { category, isDefault: true },
      orderBy: { updatedAt: 'desc' }
    });
  }

  /**
   * Deletes a clause from the library.
   */
  static async delete(id: string) {
    await this.getById(id);
    return await prisma.libraryClause.delete({
      where: { id }
    });
  }
}
