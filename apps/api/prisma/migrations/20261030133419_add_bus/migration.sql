-- CreateEnum
CREATE TYPE "BusDirection" AS ENUM ('from_campus', 'to_campus');

-- CreateEnum
CREATE TYPE "BusColor" AS ENUM ('blue', 'orange', 'green', 'red', 'purple', 'teal');

-- CreateTable
CREATE TABLE "bus_routes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" "BusColor" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bus_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bus_stops" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "minutesFromCampus" INTEGER NOT NULL,

    CONSTRAINT "bus_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bus_trips" (
    "id" UUID NOT NULL,
    "routeId" UUID NOT NULL,
    "direction" "BusDirection" NOT NULL,
    "departMinutes" INTEGER NOT NULL,
    "days" INTEGER[],
    "note" TEXT,

    CONSTRAINT "bus_trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bus_notices" (
    "id" UUID NOT NULL,
    "routeId" UUID,
    "message" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bus_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bus_routes_name_key" ON "bus_routes"("name");

-- CreateIndex
CREATE INDEX "bus_stops_routeId_position_idx" ON "bus_stops"("routeId", "position");

-- CreateIndex
CREATE INDEX "bus_trips_routeId_idx" ON "bus_trips"("routeId");

-- CreateIndex
CREATE INDEX "bus_notices_endsOn_idx" ON "bus_notices"("endsOn");

-- AddForeignKey
ALTER TABLE "bus_stops" ADD CONSTRAINT "bus_stops_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "bus_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_trips" ADD CONSTRAINT "bus_trips_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "bus_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_notices" ADD CONSTRAINT "bus_notices_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "bus_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
