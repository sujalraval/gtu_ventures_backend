-- CreateTable
CREATE TABLE "WebInventoryCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebInventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebInventoryItem" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER,
    "name" TEXT NOT NULL,
    "imagePath" TEXT,
    "description" TEXT,
    "specification" TEXT,
    "quantity" TEXT,
    "make" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebInventoryCategory_slug_key" ON "WebInventoryCategory"("slug");

-- CreateIndex
CREATE INDEX "WebInventoryCategory_order_idx" ON "WebInventoryCategory"("order");

-- CreateIndex
CREATE INDEX "WebInventoryItem_categoryId_idx" ON "WebInventoryItem"("categoryId");

-- CreateIndex
CREATE INDEX "WebInventoryItem_order_idx" ON "WebInventoryItem"("order");

-- AddForeignKey
ALTER TABLE "WebInventoryItem" ADD CONSTRAINT "WebInventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WebInventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
