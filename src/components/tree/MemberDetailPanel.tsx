'use client';

import { useState } from 'react';
import Link from 'next/link';
import { generationTier, toRoman } from '@/lib/tree/generations';
import { lifespanLabel, memberStatus } from '@/lib/tree/member-status';
import { ProposeDialog } from '@/components/requests/ProposeDialog';
import { InviteDialog } from '@/components/tree/InviteDialog';
import { RelationshipDialog } from '@/components/tree/RelationshipDialog';
import { formFromPanel } from '@/lib/requests/requests';
import { MediaGallery } from '@/components/media/MediaGallery';
import { ChildrenSection } from './member-panel/ChildrenSection';
import { EditProfileForm } from './member-panel/EditProfileForm';
import { ACTION_ICONS, ActionTile, AvatarOrInitial, PanelSection } from './member-panel/PanelParts';
import { hasProfileInfo, motherNameOf } from './member-panel/profileInfo';
import { ProfileInfoList } from './member-panel/ProfileInfoList';
import { SpousesSection } from './member-panel/SpousesSection';
import { dangerOutlineButton, outlineButton } from './member-panel/styles';
import { useEscapeToClose, useModalFocus, usePanelExtras } from './member-panel/usePanelBehavior';
import type {
  AvatarChange,
  MemberDetailPanelProps,
  MemberUpdateInput,
  MutationResult,
} from './member-panel/types';

export type {
  AvatarUploadResult,
  MemberDetailPanelChild,
  MemberDetailPanelProps,
  MemberUpdateInput,
  MutationResult,
  PanelMe,
  PanelProfile,
  PanelSpouse,
  ParentOption,
  SpouseAddInput,
  SpouseUpdateInput,
} from './member-panel/types';

const GENDER_LABELS = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
} as const;

export function MemberDetailPanel({
  memberId,
  canEdit,
  canPropose = false,
  me = null,
  onMeChanged,
  name,
  generation,
  ancestorPath,
  birthYear,
  deathYear,
  gender,
  notes,
  avatarUrl,
  profile,
  siblingRank,
  branch,
  restingPlace = null,
  signedIn = false,
  parentId,
  parentOptions,
  motherOptions,
  childMembers,
  spouses,
  isDetailLoading,
  detailLoadError,
  onRetryLoadDetail,
  onViewBranch,
  onClose,
  onUpdate,
  onAddChild,
  onDelete,
  onAddSpouse,
  onUpdateSpouse,
  onDeleteSpouse,
  onUploadAvatar,
  onDeleteAvatar,
}: MemberDetailPanelProps) {
  const ancestors = ancestorPath.slice(0, -1);

  const [tab, setTab] = useState<'bio' | 'family'>('bio');
  const [showRelationship, setShowRelationship] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [linkingMe, setLinkingMe] = useState(false);
  const isMe = me?.member?.id === memberId;
  const [isEditing, setIsEditing] = useState(false);
  const [spouseEditing, setSpouseEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProposing, setIsProposing] = useState(false);

  const { mentions, poem } = usePanelExtras(memberId, canEdit);
  useEscapeToClose(onClose, isEditing || spouseEditing);
  const panelRef = useModalFocus();

  /** Runs a mutation behind the panel's busy flag and error line; true when it succeeded. */
  async function run(action: () => Promise<MutationResult>, fallbackError: string): Promise<boolean> {
    setIsSubmitting(true);
    setActionError(null);
    const result = await action();
    setIsSubmitting(false);
    if (!result.ok) setActionError(result.error ?? fallbackError);
    return result.ok;
  }

  async function handleSaveProfile(input: MemberUpdateInput, avatar: AvatarChange): Promise<boolean> {
    const ok = await run(async () => {
      if (avatar.remove) {
        const removed = await onDeleteAvatar();
        if (!removed.ok) return { ok: false, error: removed.error ?? 'Không thể xoá ảnh. Vui lòng thử lại.' };
      } else if (avatar.file) {
        const uploaded = await onUploadAvatar(avatar.file);
        if (!uploaded.ok) return { ok: false, error: uploaded.error ?? 'Không thể tải ảnh lên. Vui lòng thử lại.' };
      }
      return onUpdate(input);
    }, 'Không thể lưu. Vui lòng thử lại.');
    if (ok) setIsEditing(false);
    return ok;
  }

  async function handleDelete() {
    if (!window.confirm(`Xoá "${name}"? Hành động này không thể hoàn tác.`)) return;
    await run(onDelete, 'Không thể xoá. Vui lòng thử lại.');
  }

  async function handleLinkMe() {
    if (!me) return;
    setLinkingMe(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/users/${me.userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (response.status === 409) setActionError('Người này đã gắn với một tài khoản khác.');
      else if (!response.ok) setActionError('Không gắn được. Vui lòng thử lại.');
      else onMeChanged?.();
    } catch {
      setActionError('Không thể kết nối tới máy chủ.');
    } finally {
      setLinkingMe(false);
    }
  }

  const lifespan = lifespanLabel(birthYear, deathYear);
  const status = memberStatus(birthYear, deathYear);
  const tier = generationTier(generation);
  const detailReady = !isDetailLoading && !detailLoadError;
  const motherName = motherNameOf(profile, motherOptions);
  const showInfo = detailReady && hasProfileInfo(profile, branch, restingPlace, motherName);

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/30 xl:hidden"
        onClick={() => {
          // A stray tap on the backdrop must not throw away an edit in progress.
          if (isEditing || spouseEditing) return;
          onClose();
        }}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="complementary"
        aria-label={`Hồ sơ ${name}`}
        className="shadow-float fixed inset-x-0 bottom-0 z-40 flex max-h-[90vh] flex-col outline-none overflow-hidden rounded-t-2xl border-default border-t bg-surface md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:border-l md:border-t-0"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span
            className="rounded px-2.5 py-1 text-[11px] font-semibold tracking-wide"
            style={{ backgroundColor: `var(--color-tier-${tier})`, color: `var(--color-on-tier-${tier})` }}
          >
            ĐỜI {toRoman(generation)}
          </span>
          {siblingRank && <span className="ms-2 me-auto text-xs font-medium text-muted">{siblingRank}</span>}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center gap-x-2 rounded-lg border-default border bg-surface px-3 text-sm font-medium text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Đóng
          </button>
        </div>

        <div className="flex items-center gap-x-4 px-5 pb-4 pt-3">
          <AvatarOrInitial src={avatarUrl} initial={name.charAt(0)} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-default">{name}</h2>
            {isDetailLoading && <p className="mt-1 text-sm text-muted">Đang tải chi tiết...</p>}
            {detailLoadError && (
              <p className="mt-1 text-sm text-danger">
                Không thể tải chi tiết.{' '}
                <button type="button" onClick={onRetryLoadDetail} className="underline">
                  Thử lại
                </button>
              </p>
            )}
            {detailReady && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {status === 'living' && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--color-living)', color: 'var(--color-on-living)' }}
                  >
                    Đang sống
                  </span>
                )}
                {lifespan && <span>{lifespan}</span>}
                {gender && <span>· {GENDER_LABELS[gender]}</span>}
              </div>
            )}
          </div>
        </div>

        {detailReady && !isEditing && (canEdit || canPropose) && (
          <div className="flex gap-2 px-5 pb-3">
            {canEdit ? (
              <>
                <ActionTile label="Lịch sử" href={`/nhat-ky?member=${memberId}`} icon={ACTION_ICONS.history} />
                <ActionTile label="Sửa" onClick={() => setIsEditing(true)} icon={ACTION_ICONS.edit} />
                {!isMe && <ActionTile label="Mời người này" onClick={() => setShowInvite(true)} icon={ACTION_ICONS.invite} />}
              </>
            ) : (
              <ActionTile label="Đề xuất chỉnh sửa" onClick={() => setIsProposing(true)} icon={ACTION_ICONS.edit} />
            )}
          </div>
        )}
        {canEdit && !isEditing && !isMe && me?.role === 'admin' && (
          <p className="px-5 pb-3">
            <button
              type="button"
              disabled={linkingMe}
              onClick={() => void handleLinkMe()}
              className="min-h-11 rounded-lg border-default border bg-surface px-3 text-sm font-medium text-default hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
            >
              {linkingMe ? 'Đang gắn…' : 'Đây là tôi'}
            </button>
          </p>
        )}
        {isMe && (
          <p className="px-5 pb-3 text-sm text-default">
            <span className="rounded-full border border-[var(--color-text)] px-2 py-0.5 text-sm font-medium">Đây là bạn</span>
          </p>
        )}

        <div role="tablist" aria-label="Nội dung hồ sơ" className="flex border-default border-b px-5">
          {(
            [
              ['bio', 'Tiểu sử'],
              ['family', 'Hôn phối & con'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`panel-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={tab === id ? `panel-tabpanel-${id}` : undefined}
              onClick={() => setTab(id)}
              className={`min-h-11 border-b-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                tab === id ? 'border-[var(--color-primary)] text-primary' : 'border-transparent text-muted hover:text-default'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-tabpanel-${tab}`}
          aria-labelledby={`panel-tab-${tab}`}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          {actionError && (
            <p role="alert" className="mb-4 text-sm text-danger">
              {actionError}
            </p>
          )}

          {tab === 'bio' && (
            <>
              {isEditing ? (
                <EditProfileForm
                  name={name}
                  birthYear={birthYear}
                  deathYear={deathYear}
                  gender={gender}
                  notes={notes}
                  avatarUrl={avatarUrl}
                  profile={profile}
                  parentId={parentId}
                  parentOptions={parentOptions}
                  motherOptions={motherOptions}
                  restingPlace={restingPlace}
                  isSubmitting={isSubmitting}
                  onError={setActionError}
                  onSave={handleSaveProfile}
                  onCancel={() => setIsEditing(false)}
                />
              ) : (
                <>
                  {showInfo && (
                    <PanelSection title="Thông tin" first>
                      <ProfileInfoList
                        profile={profile}
                        birthYear={birthYear}
                        deathYear={deathYear}
                        branch={branch}
                        restingPlace={restingPlace}
                        motherName={motherName}
                      />
                    </PanelSection>
                  )}

                  <PanelSection title="Hành trạng & công đức" first={!showInfo}>
                    <div className="rounded-lg bg-surface-muted p-4 text-sm leading-6 text-default">
                      {detailReady && notes ? (
                        <p className="whitespace-pre-wrap">{notes}</p>
                      ) : (
                        <p className="text-center text-muted">{detailReady ? 'Chưa có ghi chú.' : 'Đang chờ dữ liệu...'}</p>
                      )}
                    </div>
                  </PanelSection>
                </>
              )}

              {signedIn && detailReady && (
                <PanelSection title="Tư liệu & bút tích" label="Tư liệu và bút tích">
                  <MediaGallery ownerKind="members" ownerId={memberId} canEdit={canEdit} variant="panel" />
                </PanelSection>
              )}

              {mentions.length > 0 && (
                <PanelSection title="Được nhắc trong" label="Được nhắc trong">
                  <ul className="space-y-1">
                    {mentions.map((a) => (
                      <li key={a.id}>
                        <Link href={`/su-ky/${a.slug}`} className="text-sm text-primary underline">
                          {a.title}
                        </Link>
                        {a.status === 'draft' && <span className="ms-2 text-xs text-muted">(bản nháp)</span>}
                      </li>
                    ))}
                  </ul>
                </PanelSection>
              )}

              <PanelSection title="Họ hàng" label="Họ hàng và nhánh">
                {ancestors.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-default">Dòng tổ tiên</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{ancestors.join(' → ')}</p>
                  </div>
                )}
                <button type="button" onClick={() => setShowRelationship(true)} className={outlineButton}>
                  Xem quan hệ họ hàng…
                </button>
              </PanelSection>

              {((onViewBranch && childMembers.length > 0) || canEdit) && (
                <div className="mt-6 flex items-center justify-between gap-x-3 border-t border-[var(--color-border)] pt-5">
                  {onViewBranch && childMembers.length > 0 ? (
                    <button type="button" onClick={onViewBranch} className={outlineButton}>
                      Xem riêng nhánh này
                    </button>
                  ) : (
                    <span />
                  )}
                  {canEdit && (
                    <button type="button" onClick={handleDelete} disabled={isSubmitting} className={dangerOutlineButton}>
                      Xoá thành viên
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'family' && (
            <>
              <SpousesSection
                spouses={spouses}
                canEdit={canEdit}
                isDetailLoading={isDetailLoading}
                detailLoadError={detailLoadError}
                isSubmitting={isSubmitting}
                run={run}
                onAddSpouse={onAddSpouse}
                onUpdateSpouse={onUpdateSpouse}
                onDeleteSpouse={onDeleteSpouse}
                onEditingChange={setSpouseEditing}
              />
              <ChildrenSection
                childMembers={childMembers}
                canEdit={canEdit}
                childGeneration={generation + 1}
                poem={poem}
                isSubmitting={isSubmitting}
                run={run}
                onAddChild={onAddChild}
              />
            </>
          )}
        </div>
      </aside>
      {showRelationship && <RelationshipDialog memberId={memberId} memberName={name} myMember={me?.member ?? null} onClose={() => setShowRelationship(false)} />}
      {showInvite && <InviteDialog memberId={memberId} memberName={name} onClose={() => setShowInvite(false)} />}
      {isProposing && (
        <ProposeDialog
          memberId={memberId}
          memberName={name}
          initial={formFromPanel(name, { birthYear, deathYear, gender, notes, profile })}
          onClose={() => setIsProposing(false)}
        />
      )}
    </>
  );
}
