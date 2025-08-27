export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Parking OpenData API",
    version: "1.0.0",
    description:
      "Javni API za open data o zauzetosti parkinga (posljednje stanje + historija).",
  },
  servers: [{ url: "http://localhost:4000" }],
  components: {
    schemas: {
      ParkingRow: {
        type: "object",
        properties: {
          parkingId: { type: "string" },
          parkingName: { type: "string" },
          cityName: { type: "string" },
          zoneName: { type: "string" },
          zoneColor: { type: "string" },
          numberOfParkingPlaces: { type: "integer" },
          totalNumberOfRegularPlaces: { type: "integer" },
          freeNumberOfRegularPlaces: { type: "integer" },
          totalNumberOfSpecialPlaces: { type: "integer" },
          freeNumberOfSpecialPlaces: { type: "integer" },
          parkingTypeId: { type: "string" },
          locationId: { type: "string" },
          longitude: { type: "number" },
          latitude: { type: "number" },
          parkingAddress: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: [
          "parkingId",
          "parkingName",
          "numberOfParkingPlaces",
          "totalNumberOfRegularPlaces",
          "totalNumberOfSpecialPlaces",
          "createdAt",
        ],
      },
      PagedResponse: {
        type: "object",
        properties: {
          page: { type: "integer" },
          pageSize: { type: "integer" },
          total: { type: "integer" },
          rows: {
            type: "array",
            items: { $ref: "#/components/schemas/ParkingRow" },
          },
        },
      },
      OverviewStats: {
        type: "object",
        properties: {
          total: { type: "integer" },
          free: { type: "integer" },
          occupied: { type: "integer" },
          occupancyRatio: { type: "number" },
          lastUpdated: { type: "string", format: "date-time", nullable: true },
        },
      },
      Document: {
        type: "object",
        properties: {
          id: { type: "integer" },
          title: { type: "string" },
          doc_type: { type: "string" },
          description: { type: "string" },
          file_url: { type: "string", format: "uri" },
          published_at: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      PagedDocuments: {
        type: "object",
        properties: {
          page: { type: "integer" },
          pageSize: { type: "integer" },
          total: { type: "integer" },
          rows: {
            type: "array",
            items: { $ref: "#/components/schemas/Document" },
          },
        },
      },
      PeaksResponse: {
        type: "object",
        properties: {
          hourly: {
            type: "array",
            items: {
              type: "object",
              properties: {
                hour: { type: "string" },
                occupancyRatioAvg: { type: "number" },
                samples: { type: "integer" },
              },
            },
          },
          daily: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dow: { type: "integer", minimum: 0, maximum: 6 },
                day: { type: "string" },
                occupancyRatioMax: { type: "number" },
                samples: { type: "integer" },
              },
            },
          },
          from: { type: "string", format: "date-time", nullable: true },
          to: { type: "string", format: "date-time", nullable: true },
          lastUpdated: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
    parameters: {
      q: {
        in: "query",
        name: "q",
        schema: { type: "string" },
        description: "Pretraga po nazivu/adresi",
      },
      doc_type: { in: "query", name: "doc_type", schema: { type: "string" } },
      cityName: { in: "query", name: "cityName", schema: { type: "string" } },
      zoneName: { in: "query", name: "zoneName", schema: { type: "string" } },
      parkingId: { in: "query", name: "parkingId", schema: { type: "string" } },
      typeParam: {
        in: "query",
        name: "type",
        schema: { type: "string", enum: ["last", "history"] },
        default: "last",
      },

      parkingTypeId: {
        in: "query",
        name: "parkingTypeId",
        schema: { type: "string" },
      },
      minFree: {
        in: "query",
        name: "minFree",
        schema: { type: "integer", minimum: 0 },
      },
      sort: {
        in: "query",
        name: "sort",
        schema: {
          type: "string",
          enum: [
            "parkingName",
            "cityName",
            "zoneName",
            "createdAt",
            "free",
            "occupancyRatio",
          ],
        },
        default: "createdAt",
      },
      order: {
        in: "query",
        name: "order",
        schema: { type: "string", enum: ["asc", "desc"] },
        default: "desc",
      },
      page: {
        in: "query",
        name: "page",
        schema: { type: "integer", minimum: 1 },
        default: 1,
      },
      pageSize: {
        in: "query",
        name: "pageSize",
        schema: { type: "integer", minimum: 1, maximum: 200 },
        default: 20,
      },
      from: {
        in: "query",
        name: "from",
        schema: { type: "string", format: "date-time" },
      },
      to: {
        in: "query",
        name: "to",
        schema: { type: "string", format: "date-time" },
      },
      format: {
        in: "query",
        name: "format",
        schema: { type: "string", enum: ["csv", "json", "xlsx", "xml"] },
        default: "csv",
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/dumps": {
      get: {
        summary: "Lista dostupnih mjesečnih dumpova (CSV.gz)",
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/stats/daily": {
      get: {
        summary: "Dnevni agregati zauzetosti (po parkingu i danu)",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/zoneName" },
          { $ref: "#/components/parameters/parkingTypeId" },
          {
            in: "query",
            name: "parkingId",
            schema: { type: "string" },
            description: "CSV lista parkingId vrijednosti",
          },
          { $ref: "#/components/parameters/from" },
          { $ref: "#/components/parameters/to" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/stats/monthly": {
      get: {
        summary: "Mjesečni agregati zauzetosti (po parkingu i mjesecu)",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/zoneName" },
          { $ref: "#/components/parameters/parkingTypeId" },
          {
            in: "query",
            name: "parkingId",
            schema: { type: "string" },
            description: "CSV lista parkingId vrijednosti",
          },
          {
            in: "query",
            name: "from",
            schema: { type: "string", example: "2025-01" },
          },
          {
            in: "query",
            name: "to",
            schema: { type: "string", example: "2025-12" },
          },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/parkings": {
      get: {
        summary: "Posljednje stanje po parkingu",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/cityName" },
          { $ref: "#/components/parameters/zoneName" },
          { $ref: "#/components/parameters/parkingTypeId" },
          { $ref: "#/components/parameters/minFree" },
          { $ref: "#/components/parameters/sort" },
          { $ref: "#/components/parameters/order" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PagedResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/parkings/{parkingId}/history": {
      get: {
        summary: "Historijski snapshotovi za parking",
        parameters: [
          {
            in: "path",
            name: "parkingId",
            required: true,
            schema: { type: "string" },
          },
          { $ref: "#/components/parameters/from" },
          { $ref: "#/components/parameters/to" },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ParkingRow" },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/stats/overview": {
      get: {
        summary: "Agregatni pregled",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/cityName" },
          { $ref: "#/components/parameters/zoneName" },
          { $ref: "#/components/parameters/parkingTypeId" },
          { $ref: "#/components/parameters/minFree" },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OverviewStats" },
              },
            },
          },
        },
      },
    },
    "/api/v1/stats/by-parking": {
      get: {
        summary: "Lista po parkingu za grafove",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/cityName" },
          { $ref: "#/components/parameters/zoneName" },
          { $ref: "#/components/parameters/parkingTypeId" },
          { $ref: "#/components/parameters/minFree" },
        ],
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/export": {
      get: {
        summary: "Export posljednjeg stanja",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/cityName" },
          { $ref: "#/components/parameters/zoneName" },
          { $ref: "#/components/parameters/parkingTypeId" },
          { $ref: "#/components/parameters/minFree" },
          { $ref: "#/components/parameters/sort" },
          { $ref: "#/components/parameters/order" },
          { $ref: "#/components/parameters/format" },
        ],
        responses: { 200: { description: "Datoteka" } },
      },
    },
    "/api/v1/metadata": {
      get: {
        summary: "Metapodaci skupa",
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/api-url": {
      get: {
        summary: "Generiše kanonski URL za /parkings iz upita",
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/v1/stats/peaks": {
      get: {
        summary: "Satni prosjek i dnevni maksimum zauzetosti (iz snapshotova)",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/cityName" },
          { $ref: "#/components/parameters/zoneName" },
          { $ref: "#/components/parameters/parkingTypeId" },
          { $ref: "#/components/parameters/from" },
          { $ref: "#/components/parameters/to" },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PeaksResponse" },
              },
            },
          },
        },
      },
    },
    "/api/v1/documents": {
      get: {
        summary: "Javna lista dokumenata",
        parameters: [
          { $ref: "#/components/parameters/q" },
          { $ref: "#/components/parameters/doc_type" },
          { $ref: "#/components/parameters/page" },
          { $ref: "#/components/parameters/pageSize" },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PagedDocuments" },
              },
            },
          },
        },
      },
    },
    "/api/v1/documents/{id}": {
      get: {
        summary: "Detalj dokumenta",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Document" },
              },
            },
          },
          404: { description: "Not found" },
        },
      },
    },
  },
};
