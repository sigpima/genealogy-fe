import Link from 'next/link';
import { formatPartialDate, hasDayOrMonth } from '@/lib/tree/dates';
import { directionsUrl } from '@/lib/places/places';
import { mapHrefFor } from '@/lib/places/mapLink';
import { InfoRow } from './PanelParts';
import type { BranchRef, PanelProfile, RestingPlace } from './types';

type ProfileInfoListProps = {
  profile: PanelProfile;
  birthYear: number | null;
  deathYear: number | null;
  branch: BranchRef | null;
  restingPlace: RestingPlace | null;
  motherName: string | null;
};

/** The read-only rows of the "Thông tin" block; only the ones that have a value. */
export function ProfileInfoList({ profile, birthYear, deathYear, branch, restingPlace, motherName }: ProfileInfoListProps) {
  const birthDate = formatPartialDate({
    year: birthYear,
    month: profile.birthMonth,
    day: profile.birthDay,
    isLunar: profile.birthIsLunar,
    leapMonth: profile.birthLeapMonth,
  });
  const deathDate = formatPartialDate({
    year: deathYear,
    month: profile.deathMonth,
    day: profile.deathDay,
    isLunar: profile.deathIsLunar,
    leapMonth: profile.deathLeapMonth,
  });
  const showBirthDate = hasDayOrMonth({ month: profile.birthMonth, day: profile.birthDay });
  const showDeathDate = hasDayOrMonth({ month: profile.deathMonth, day: profile.deathDay });
  const graveMapHref = mapHrefFor(profile.burialMapUrl, profile.burialLatitude, profile.burialLongitude);

  return (
    <dl className="space-y-2 text-sm">
      {profile.courtesyName && <InfoRow label="Tên tự" value={profile.courtesyName} />}
      {profile.title && <InfoRow label="Chức vị" value={profile.title} />}
      {showBirthDate && <InfoRow label="Ngày sinh" value={birthDate} />}
      {showDeathDate && <InfoRow label="Ngày mất" value={deathDate} />}
      {branch && (
        <InfoRow
          label="Thuộc chi"
          value={
            <span className="inline-flex items-center gap-x-2">
              <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ backgroundColor: branch.color }} />
              {branch.name}
            </span>
          }
        />
      )}
      {(restingPlace || profile.burialPlot) && (
        <InfoRow
          label="An nghỉ"
          value={
            <>
              {restingPlace && (
                <Link href={`/dia-diem?place=${restingPlace.id}`} className="accent-text underline">
                  {restingPlace.name}
                </Link>
              )}
              {restingPlace && profile.burialPlot && ' · '}
              {profile.burialPlot}
              {restingPlace && restingPlace.latitude !== null && restingPlace.longitude !== null && (
                <>
                  <br />
                  <a
                    href={directionsUrl(restingPlace.latitude, restingPlace.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="accent-text underline"
                  >
                    Chỉ đường
                  </a>
                </>
              )}
            </>
          }
        />
      )}
      {profile.hometown && <InfoRow label="Quê quán" value={profile.hometown} />}
      {profile.residence && <InfoRow label="Nơi ở" value={profile.residence} />}
      {motherName && <InfoRow label="Mẹ" value={motherName} />}
      {(profile.birthOrder !== null || profile.isAdopted) && (
        <InfoRow
          label="Thứ bậc"
          value={[profile.birthOrder !== null ? `Con thứ ${profile.birthOrder}` : null, profile.isAdopted ? 'Con nuôi' : null]
            .filter(Boolean)
            .join(' · ')}
        />
      )}
      {profile.phone && (
        <InfoRow
          label="Điện thoại"
          value={
            <a href={`tel:${profile.phone.replace(/[^0-9+]/g, '')}`} className="accent-text underline">
              {profile.phone}
            </a>
          }
        />
      )}
      {profile.email && (
        <InfoRow
          label="Email"
          value={
            <a href={`mailto:${profile.email}`} className="accent-text underline">
              {profile.email}
            </a>
          }
        />
      )}
      {(profile.burialPlace || profile.burialLatitude !== null || profile.burialMapUrl) && (
        <InfoRow
          label="Mộ phần"
          value={
            <>
              {profile.burialPlace}
              {graveMapHref && (
                <>
                  {profile.burialPlace && <br />}
                  <a
                    href={graveMapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="accent-text inline-flex min-h-11 items-center underline"
                  >
                    Xem trên bản đồ
                  </a>
                </>
              )}
            </>
          }
        />
      )}
    </dl>
  );
}
