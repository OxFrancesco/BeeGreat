import { api } from '@beegreat/backend/convex/_generated/api'
import type { Doc, Id } from '@beegreat/backend/convex/_generated/dataModel'
import type { UIComponent } from '@beegreat/tool-presentation'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import './crm.css'

type Contact = Doc<'crmContacts'>
const empty = {
  name: '',
  context: '',
  email: '',
  phone: '',
  note: '',
  followUpOn: '',
  lastContactedOn: '',
}

export function CrmPanel() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'all' | 'followups' | 'archived'>('all')
  const [adding, setAdding] = useState(false)
  const page = usePaginatedQuery(
    api.crm.list,
    { view, search },
    { initialNumItems: 30 },
  )
  return (
    <section className="crm-panel" aria-label="CRM">
      <div className="crm-toolbar">
        <Input
          type="search"
          aria-label="Search contacts"
          placeholder="Search contacts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button className="crm-primary" onClick={() => setAdding(true)}>
          Add contact
        </Button>
      </div>
      <div className="crm-filters" aria-label="Filter contacts">
        {(['all', 'followups', 'archived'] as const).map((value) => (
          <Button
            key={value}
            variant={view === value ? 'secondary' : 'ghost'}
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {value === 'all'
              ? 'Contacts'
              : value === 'followups'
                ? 'Follow-ups'
                : 'Archived'}
          </Button>
        ))}
      </div>
      {page.status === 'LoadingFirstPage' ? (
        <p role="status">Loading contacts…</p>
      ) : page.results.length === 0 ? (
        <p>
          {search
            ? 'No matching contacts.'
            : view === 'followups'
              ? 'No follow-ups scheduled.'
              : view === 'archived'
                ? 'No archived contacts.'
                : 'No contacts yet.'}
        </p>
      ) : null}
      <div className="crm-list">
        {page.results.map((contact) => (
          <ContactRow key={contact._id} contact={contact} />
        ))}
      </div>
      {page.status === 'CanLoadMore' || page.status === 'LoadingMore' ? (
        <Button
          variant="outline"
          disabled={page.status === 'LoadingMore'}
          onClick={() => page.loadMore(30)}
        >
          {page.status === 'LoadingMore' ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
      {adding ? (
        <ContactEditor
          onClose={() => setAdding(false)}
          onSaved={() => {
            setView('all')
            setSearch('')
          }}
        />
      ) : null}
    </section>
  )
}

function ContactRow({ contact }: { contact: Contact }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <button
        type="button"
        className="crm-contact"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${contact.name}`}
      >
        <span className="crm-avatar" aria-hidden="true">
          {contact.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="crm-contact-copy">
          <strong>{contact.name}</strong>
          {contact.context ? <span>{contact.context}</span> : null}
          {contact.note ? <p>{contact.note}</p> : null}
          {contact.followUpOn ? (
            <span className="crm-date">
              Follow up {formatDate(contact.followUpOn)}
            </span>
          ) : null}
          {contact.lastContactedOn ? (
            <span className="crm-date">
              Last contacted {formatDate(contact.lastContactedOn)}
            </span>
          ) : null}
          {contact.archived ? <span>Archived</span> : null}
        </span>
        <span aria-hidden="true">›</span>
      </button>
      {editing ? (
        <ContactEditor contact={contact} onClose={() => setEditing(false)} />
      ) : null}
    </>
  )
}

export function CrmChatCard({
  contacts,
}: Extract<UIComponent, { type: 'crm' }>) {
  return (
    <section className="crm-panel crm-chat" aria-label="CRM contacts">
      {contacts.length ? (
        contacts.map((contact) => (
          <LiveContact key={contact.id} id={contact.id} />
        ))
      ) : (
        <p>No contacts found.</p>
      )}
    </section>
  )
}

function LiveContact({ id }: { id: string }) {
  // SAFETY: contact IDs come from the shared CRM tool contract; the Convex query validates the table and signed-in owner before returning data.
  const contact = useQuery(api.crm.get, { contactId: id as Id<'crmContacts'> })
  if (contact === undefined) return <p role="status">Loading contact…</p>
  if (contact === null) return <p>Contact unavailable.</p>
  return <ContactRow contact={contact} />
}

function ContactEditor({
  contact,
  onClose,
  onSaved,
}: {
  contact?: Contact
  onSaved?: () => void
  onClose: () => void
}) {
  const [values, setValues] = useState(
    contact
      ? {
          name: contact.name,
          context: contact.context,
          email: contact.email,
          phone: contact.phone,
          note: contact.note,
          followUpOn: contact.followUpOn ?? '',
          lastContactedOn: contact.lastContactedOn ?? '',
        }
      : empty,
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const save = useMutation(api.crm.save)
  const archive = useMutation(api.crm.archive)
  async function run<Result>(action: () => Promise<Result>) {
    setPending(true)
    setError('')
    try {
      await action()
      onSaved?.()
      onClose()
    } catch {
      setError('Could not save this contact. Check the fields and try again.')
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent className="crm-editor">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit contact' : 'Add contact'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(() =>
              save({
                ...values,
                contactId: contact?._id,
                followUpOn: values.followUpOn || null,
                lastContactedOn: values.lastContactedOn || null,
              }),
            )
          }}
        >
          <fieldset disabled={pending}>
            {(
              [
                'name',
                'context',
                'email',
                'phone',
                'followUpOn',
                'lastContactedOn',
              ] as const
            ).map((field) => (
              <label key={field}>
                <span>
                  {
                    {
                      name: 'Name',
                      context: 'How you know them',
                      email: 'Email',
                      phone: 'Phone',
                      followUpOn: 'Follow-up date',
                      lastContactedOn: 'Last contacted',
                    }[field]
                  }
                </span>
                <Input
                  required={field === 'name'}
                  maxLength={field === 'name' ? 160 : 240}
                  type={
                    field.endsWith('On')
                      ? 'date'
                      : field === 'email'
                        ? 'email'
                        : field === 'phone'
                          ? 'tel'
                          : 'text'
                  }
                  value={values[field]}
                  onChange={(e) =>
                    setValues((current) => ({
                      ...current,
                      [field]: e.target.value,
                    }))
                  }
                />
              </label>
            ))}
            <label>
              <span>Notes</span>
              <Textarea
                rows={4}
                maxLength={4000}
                value={values.note}
                onChange={(e) =>
                  setValues((current) => ({ ...current, note: e.target.value }))
                }
              />
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <div className="crm-editor-actions">
              {contact ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    void run(() =>
                      archive({
                        contactId: contact._id,
                        archived: !contact.archived,
                      }),
                    )
                  }
                >
                  {contact.archived ? 'Restore contact' : 'Archive contact'}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button className="crm-primary" type="submit">
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
