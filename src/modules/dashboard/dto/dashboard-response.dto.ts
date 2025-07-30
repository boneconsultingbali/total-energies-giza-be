export class DashboardStatsDto {
  label: string;
  value: string;
  color: string;
  icon: string;
  changeText: string;
  isNegative?: boolean;
}

export class ProjectStageDto {
  name: string;
  count: number;
  color: string;
}

export class CountryProjectDto {
  code: string;
  name: string;
  count_project: number;
  color: string;
  country_flag: string;
}

export class ValuePillarDto {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

export class DashboardResponseDto {
  stats: DashboardStatsDto[];
  projectStages: ProjectStageDto[];
  mapCountries: CountryProjectDto[];
  valuePillars: ValuePillarDto[];
}
