const SECTIONS = [
  {
    title: 'איזה מידע נאסף',
    items: ['שם מלא ומספר טלפון של לקוחות העסק', 'תאריך, שעה וסוג התור שנקבע'],
  },
  {
    title: 'למה המידע משמש',
    items: [
      'ניהול לוח התורים של העסק',
      'שליחת הודעת תזכורת בוואטסאפ לפני התור',
      'סנכרון התור עם יומן Google של בעלת העסק',
    ],
  },
  {
    title: 'מי ניגש למידע',
    items: [
      'בעלת העסק בלבד. המידע אינו נמכר, מושכר, או משותף עם צד שלישי למטרות שיווק.',
    ],
  },
  {
    title: 'שירותי צד שלישי בשימוש',
    items: [
      'WhatsApp Business Platform (Meta) — לשליחת הודעות תזכורת',
      'Google Calendar API — לסנכרון תורים ליומן',
    ],
  },
]

function PrivacyPolicyPage() {
  return (
    <main className="policy-page">
      <article className="policy-card">
        <h1 className="policy-title">מדיניות פרטיות — גלי לק ג'יל</h1>
        <p className="policy-updated">עדכון אחרון: 08/09/2026</p>

        <p className="policy-intro">
          אפליקציה זו משמשת לניהול פנימי של קביעת תורים בעסק "גלי לק ג'יל".
        </p>

        {SECTIONS.map((section) => (
          <section key={section.title} className="policy-section">
            <h2 className="policy-heading">{section.title}:</h2>
            <ul className="policy-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}

        <section className="policy-section">
          <h2 className="policy-heading">מחיקת מידע:</h2>
          <p>
            לבקשת מחיקת המידע האישי שלך ממערכת זו, ניתן לפנות אל{' '}
            <a className="policy-link" href="tel:0544303064">
              0544303064
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  )
}

export default PrivacyPolicyPage
