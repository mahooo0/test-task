'use client';

import { useUser } from '@clerk/nextjs';
import type { ItemDto } from '@dataroom/types';
import { ShareMode, ShareResourceType } from '@dataroom/types';
import { Check, Copy, Globe, Loader2, Mail, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import posthog from 'posthog-js';
import { errorMessage } from '@/features/items/errors';
import { useItemShares, useShareMutations } from './hooks';

/** Pragmatic email shape check — the server is authoritative; this just stops obvious typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Share an item: invite people by email (restricted, view-only) and/or mint a public link anyone can
 * open. Reuses the resource's existing share of each mode, so re-opening the dialog shows the current
 * invitees + link. All access is read-only (VIEWER) in this MVP.
 */
export function ShareDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('share');
  const te = useTranslations('errors');
  const td = useTranslations('dialogs');
  const { user } = useUser();
  const currentEmail = user?.primaryEmailAddress?.emailAddress ?? '';
  const shares = useItemShares(item.id, open);
  const { create, revoke, addGrants, removeGrant } = useShareMutations(item.id);

  const publicShare = shares.data?.find((s) => s.mode === ShareMode.PUBLIC) ?? null;
  const restricted = shares.data?.find((s) => s.mode === ShareMode.RESTRICTED) ?? null;
  const grants = restricted?.grants ?? [];
  const busy = create.isPending || addGrants.isPending;

  const [email, setEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const link =
    publicShare?.publicToken && typeof window !== 'undefined'
      ? `${window.location.origin}/s/${publicShare.publicToken}`
      : null;

  const fail = (err: unknown) => toast.error(errorMessage(err, te('shareFailed')));

  const invite = () => {
    const value = email.trim();
    if (!value) return;
    if (!EMAIL_RE.test(value)) {
      setInviteError(t('invalidEmail'));
      return;
    }
    if (currentEmail && value.toLowerCase() === currentEmail.toLowerCase()) {
      setInviteError(t('cannotInviteYourself'));
      return;
    }
    if (grants.some((g) => g.invitedEmail.toLowerCase() === value.toLowerCase())) {
      setInviteError(t('alreadyInvited', { email: value }));
      return;
    }
    setInviteError(null);
    const done = () => {
      posthog.capture('share_invite_sent', { item_type: item.type });
      setEmail('');
      toast.success(t('inviteSent', { email: value }));
    };
    if (restricted) {
      addGrants.mutate({ shareId: restricted.id, emails: [value] }, { onSuccess: done, onError: fail });
    } else {
      create.mutate(
        {
          resourceType: ShareResourceType.ITEM,
          resourceId: item.id,
          mode: ShareMode.RESTRICTED,
          invitedEmails: [value],
        },
        { onSuccess: done, onError: fail },
      );
    }
  };

  const createLink = () =>
    create.mutate(
      {
        resourceType: ShareResourceType.ITEM,
        resourceId: item.id,
        mode: ShareMode.PUBLIC,
      },
      {
        onSuccess: () => {
          posthog.capture('share_link_created', { item_type: item.type });
          toast.success(t('linkCreated'));
        },
        onError: fail,
      },
    );

  const revokeLink = () => {
    if (!publicShare) return;
    revoke.mutate(publicShare.id, {
      onSuccess: () => {
        posthog.capture('share_link_revoked', { item_type: item.type });
        toast.success(t('linkRemoved'));
        setConfirmRevoke(false);
      },
      onError: fail,
    });
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success(t('linkCopied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(te('shareFailed'));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="truncate">{t('title', { name: item.name })}</DialogTitle>
            <DialogDescription>{t('subtitle')}</DialogDescription>
          </DialogHeader>

          {/* Never fabricate an empty "not shared / link off" state before the current shares are known —
              show progress while loading and a recoverable error if the fetch fails. */}
          {shares.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : shares.isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-muted-foreground text-sm">{te('boundaryTitle')}</p>
              <Button size="sm" variant="outline" onClick={() => shares.refetch()}>
                {te('tryAgain')}
              </Button>
            </div>
          ) : (
            <>
              {/* Invite by email */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (inviteError) setInviteError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        invite();
                      }
                    }}
                    placeholder={t('emailPlaceholder')}
                    aria-label={t('emailPlaceholder')}
                    aria-invalid={inviteError ? true : undefined}
                  />
                  <Button size="sm" onClick={invite} disabled={busy || email.trim().length === 0}>
                    {busy ? <Loader2 className="animate-spin" /> : <Mail />}
                    {t('invite')}
                  </Button>
                </div>

                {inviteError ? (
                  <p className="text-destructive text-xs">{inviteError}</p>
                ) : (
                  // Access is granted immediately (pull-based); we don't send an email — be explicit so
                  // the owner doesn't expect a notification to go out.
                  <p className="text-muted-foreground text-xs">{t('inviteNote')}</p>
                )}

                {grants.length > 0 && (
                  <ul className="space-y-1">
                    {grants.map((g) => (
                      <li
                        key={g.id}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span className="min-w-0 truncate">{g.invitedEmail}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-muted-foreground text-xs">{t('viewer')}</span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('removeInvitee', { email: g.invitedEmail })}
                            onClick={() =>
                              restricted &&
                              removeGrant.mutate(
                                { shareId: restricted.id, grantId: g.id },
                                {
                                  onSuccess: () =>
                                    toast.success(t('accessRemoved', { email: g.invitedEmail })),
                                  onError: fail,
                                },
                              )
                            }
                          >
                            <X />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Public link */}
              <section className="space-y-2 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Globe className="size-4 text-muted-foreground" />
                  {t('publicLink')}
                </div>
                {link ? (
                  <>
                    <p className="text-muted-foreground text-xs">{t('publicLinkOn')}</p>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={link}
                        className="text-xs"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Button size="sm" variant="outline" onClick={copyLink}>
                        {copied ? <Check /> : <Copy />}
                        {copied ? t('copied') : t('copy')}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmRevoke(true)}
                      disabled={revoke.isPending}
                    >
                      <Trash2 />
                      {t('removeLink')}
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-muted-foreground text-xs">{t('publicLinkOff')}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={createLink}
                      disabled={create.isPending}
                    >
                      {create.isPending ? <Loader2 className="animate-spin" /> : <Globe />}
                      {t('createLink')}
                    </Button>
                  </div>
                )}
              </section>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoking a public link is destructive (every holder loses access) — confirm before firing. */}
      <Dialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('revokeLinkTitle')}</DialogTitle>
            <DialogDescription>{t('revokeLinkDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmRevoke(false)}>
              {td('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={revoke.isPending}
              onClick={revokeLink}
            >
              {revoke.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t('revokeLinkConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
