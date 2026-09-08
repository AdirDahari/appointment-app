import { Fragment, useEffect, useState } from 'react'
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../api/customersApi'
import CustomerCard from '../components/CustomerCard'
import CustomerForm from '../components/CustomerForm'
import { PlusIcon, SearchIcon, UsersIcon } from '../components/Icons'

function groupByFirstLetter(customers) {
  const groups = []
  for (const customer of customers) {
    const letter = customer.full_name.trim().charAt(0).toUpperCase() || '#'
    const currentGroup = groups[groups.length - 1]
    if (currentGroup && currentGroup.letter === letter) {
      currentGroup.items.push(customer)
    } else {
      groups.push({ letter, items: [customer] })
    }
  }
  return groups
}

function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [showForm, setShowForm] = useState(false)

  async function loadCustomers(currentSearch) {
    setLoading(true)
    setLoadError('')
    try {
      const data = await getCustomers(currentSearch)
      setCustomers(data)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => loadCustomers(search), 250)
    return () => clearTimeout(timeoutId)
  }, [search])

  function openAddForm() {
    setEditingCustomer(null)
    setShowForm(true)
  }

  function openEditForm(customer) {
    setEditingCustomer(customer)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingCustomer(null)
  }

  async function handleFormSubmit(data) {
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, data)
    } else {
      await createCustomer(data)
    }
    closeForm()
    await loadCustomers(search)
  }

  async function handleDelete(customer) {
    if (!window.confirm(`למחוק את ${customer.full_name}?`)) return
    try {
      await deleteCustomer(customer.id)
      await loadCustomers(search)
    } catch (err) {
      if (err.status === 409) {
        if (window.confirm(`${err.message}\n\nלמחוק בכל זאת?`)) {
          await deleteCustomer(customer.id, { force: true })
          await loadCustomers(search)
        }
      } else {
        window.alert(err.message)
      }
    }
  }

  return (
    <main className="page">
      <div className="toolbar">
        <div className="search">
          <span className="search-icon">
            <SearchIcon size={18} />
          </span>
          <input
            type="search"
            aria-label="חיפוש לקוח לפי שם"
            placeholder="חיפוש לקוח..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button type="button" className="round-btn" aria-label="לקוח חדש" onClick={openAddForm}>
          <PlusIcon size={22} />
        </button>
      </div>

      {loadError && <div className="alert alert-error">{loadError}</div>}

      {loading ? (
        <div className="empty">טוען...</div>
      ) : customers.length === 0 ? (
        <div className="empty">
          <span className="empty-icon">
            <UsersIcon size={24} />
          </span>
          <span className="empty-title">{search ? 'לא נמצאו לקוחות' : 'עדיין אין לקוחות'}</span>
          <span>{search ? 'נסי חיפוש אחר' : 'הוסיפי את הלקוחה הראשונה שלך'}</span>
        </div>
      ) : (
        <div className="section">
          {groupByFirstLetter(customers).map((group) => (
            <Fragment key={group.letter}>
              <div className="day-label">{group.letter}</div>
              <ul className="stack">
                {group.items.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onEdit={openEditForm}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </Fragment>
          ))}
        </div>
      )}

      {showForm && (
        <CustomerForm initialValues={editingCustomer} onSubmit={handleFormSubmit} onCancel={closeForm} />
      )}
    </main>
  )
}

export default CustomersPage
