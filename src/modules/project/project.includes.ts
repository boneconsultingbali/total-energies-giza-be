import { Prisma } from "@prisma/client";

/**
 * Type-safe include options for project queries
 */
export interface ProjectIncludeOptions {
  owner?: boolean;
  tenant?: boolean;
  indicators?: boolean;
  statuses?: boolean;
  documents?: boolean;
  _count?: boolean;
}

/**
 * Helper function to build type-safe include options for project queries
 */
export function buildProjectInclude(
  options: ProjectIncludeOptions = {}
): Prisma.tbm_projectInclude {
  const include: Prisma.tbm_projectInclude = {};

  if (options.owner) {
    include.owner = {
      select: {
        id: true,
        email: true,
        code: true,
        is_active: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
            avatar: true,
          },
        },
      },
    };
  }

  if (options.tenant) {
    include.tenant = {
      select: {
        id: true,
        code: true,
        name: true,
        country: true,
      },
    };
  }

  if (options.indicators) {
    include.indicators = {
      include: {
        indicator: {
          select: {
            id: true,
            name: true,
            description: true,
            pillar: true,
            parent: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        indicator: {
          name: "asc",
        },
      },
    };
  }

  if (options.statuses) {
    include.statuses = {
      orderBy: {
        created_at: "desc",
      },
      take: 10, // Limit to recent statuses
    };
  }

  if (options.documents) {
    include.documents = {
      select: {
        id: true,
        name: true,
        content: true,
        created_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    };
  }

  if (options._count) {
    include._count = {
      select: {
        indicators: true,
        statuses: true,
        documents: true,
      },
    };
  }

  return include;
}

/**
 * Type-safe select options for project list queries (minimal data)
 */
export const PROJECT_LIST_SELECT: Prisma.tbm_projectSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  status: true,
  country: true,
  score: true,
  start_date: true,
  end_date: true,
  created_at: true,
  updated_at: true,
  owner_id: true,
  tenant_id: true,
  domains: true,
  pillars: true,
  owner: {
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
    },
  },
  tenant: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  _count: {
    select: {
      indicators: true,
      statuses: true,
      documents: true,
    },
  },
};

/**
 * Type-safe select options for project detail queries (full data)
 */
export const PROJECT_DETAIL_INCLUDE: Prisma.tbm_projectInclude = {
  owner: {
    select: {
      id: true,
      email: true,
      code: true,
      is_active: true,
      profile: {
        select: {
          first_name: true,
          last_name: true,
          avatar: true,
          phone: true,
        },
      },
    },
  },
  tenant: {
    select: {
      id: true,
      code: true,
      name: true,
      country: true,
      address: true,
    },
  },
  timelines: {
    include: {
      creator: {
        select: {
          id: true,
          email: true,
          code: true,
          is_active: true,
          profile: {
            select: {
              first_name: true,
              last_name: true,
              avatar: true,
              phone: true,
            },
          },
        },
      },
    },
  },
  indicators: {
    include: {
      indicator: {
        select: {
          id: true,
          name: true,
          description: true,
          pillar: true,
          parent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      indicator: {
        name: "asc",
      },
    },
  },
  statuses: {
    orderBy: {
      created_at: "desc",
    },
  },
  documents: {
    select: {
      id: true,
      name: true,
      content: true,
      created_at: true,
    },
    orderBy: {
      created_at: "desc",
    },
  },
  _count: {
    select: {
      indicators: true,
      statuses: true,
      documents: true,
    },
  },
};
