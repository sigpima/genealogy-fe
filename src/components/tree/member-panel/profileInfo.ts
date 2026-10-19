import { hasDayOrMonth } from '../../../lib/tree/dates';
import type { BranchRef, ParentOption, PanelProfile, RestingPlace } from './types';

export function motherNameOf(profile: PanelProfile, motherOptions: ParentOption[]): string | null {
  return profile.motherId === null ? null : (motherOptions.find((o) => o.id === profile.motherId)?.name ?? null);
}

/** True when the "Thông tin" block has at least one row to show. */
export function hasProfileInfo(
  profile: PanelProfile,
  branch: BranchRef | null,
  restingPlace: RestingPlace | null,
  motherName: string | null
): boolean {
  return Boolean(
    profile.courtesyName ||
      profile.title ||
      profile.residence ||
      profile.hometown ||
      profile.phone ||
      profile.email ||
      profile.burialPlace ||
      profile.burialLatitude !== null ||
      Boolean(profile.burialMapUrl) ||
      hasDayOrMonth({ month: profile.birthMonth, day: profile.birthDay }) ||
      hasDayOrMonth({ month: profile.deathMonth, day: profile.deathDay }) ||
      branch !== null ||
      restingPlace !== null ||
      Boolean(profile.burialPlot) ||
      profile.birthOrder !== null ||
      profile.isAdopted ||
      motherName
  );
}
