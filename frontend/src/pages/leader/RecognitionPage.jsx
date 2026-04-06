import { useEffect, useMemo, useState } from 'react';
import { createTeamRecognition, getTeamRecognition } from '../../api/index.js';
import { Badge, Btn, Input, Spinner, Textarea, useToast } from '../../components/shared/index.jsx';
import { useLanguage } from '../../context/LanguageContext';

const INITIAL_FORM = {
  employeeID: '',
  title: '',
  category: 'Achievement',
  message: '',
  points: 10,
  recognitionDate: new Date().toISOString().slice(0, 10),
};

const CATEGORY_COLORS = {
  Achievement: 'green',
  Appreciation: 'orange',
  Innovation: 'blue',
  Teamwork: 'gray',
  Leadership: 'red',
};

export function TeamRecognitionPage() {
  const toast = useToast();
  const { t } = useLanguage();
  const [awards, setAwards] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadAwards = async () => {
    setLoading(true);
    try {
      const data = await getTeamRecognition();
      setAwards(Array.isArray(data) ? data : []);
    } catch (error) {
      toast(error.message || 'Failed to load team recognition awards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAwards();
  }, []);

  const stats = useMemo(() => ({
    totalAwards: awards.length,
    totalPoints: awards.reduce((sum, item) => sum + Number(item.points || 0), 0),
    thisMonth: awards.filter((item) => String(item.recognitionDate || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).length,
  }), [awards]);

  const recognitionBoard = useMemo(() => {
    const categoryMap = new Map();
    const peopleMap = new Map();

    awards.forEach((award) => {
      const categoryKey = award.category || 'Achievement';
      const categoryEntry = categoryMap.get(categoryKey) || { category: categoryKey, count: 0, points: 0 };
      categoryEntry.count += 1;
      categoryEntry.points += Number(award.points || 0);
      categoryMap.set(categoryKey, categoryEntry);

      const personKey = award.employeeID || award.employeeName || String(award.awardID);
      const personEntry = peopleMap.get(personKey) || {
        key: personKey,
        employeeName: award.employeeName || award.employeeID || '—',
        team: award.team,
        count: 0,
        points: 0,
        lastDate: award.recognitionDate || '',
      };
      personEntry.count += 1;
      personEntry.points += Number(award.points || 0);
      if (String(award.recognitionDate || '') > String(personEntry.lastDate || '')) {
        personEntry.lastDate = award.recognitionDate;
      }
      peopleMap.set(personKey, personEntry);
    });

    const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count || b.points - a.points);
    const people = Array.from(peopleMap.values()).sort((a, b) => b.count - a.count || b.points - a.points).slice(0, 5);

    return {
      categories,
      people,
      recognizedEmployees: peopleMap.size,
      averagePoints: awards.length ? Math.round(stats.totalPoints / awards.length) : 0,
      topCategory: categories[0]?.category || '—',
    };
  }, [awards, stats.totalPoints]);

  const handleCreate = async () => {
    if (!form.employeeID.trim() || !form.title.trim()) {
      toast('Employee ID and title are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await createTeamRecognition({
        employeeID: form.employeeID.trim(),
        title: form.title.trim(),
        category: form.category,
        message: form.message.trim(),
        points: Number(form.points || 0),
        recognitionDate: form.recognitionDate || null,
      });
      toast('Recognition award created');
      setForm({ ...INITIAL_FORM, recognitionDate: new Date().toISOString().slice(0, 10) });
      await loadAwards();
    } catch (error) {
      toast(error.message || 'Failed to create recognition award', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hr-page-shell" style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 80px' }}>
      <div className="hr-page-header" style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('Recognition & Rewards')}</h2>
        <p style={{ fontSize: 13.5, color: 'var(--gray-500)' }}>
          {t('Celebrate achievements, share appreciation, and award points to your team members.')}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: t('Awards Shared'), value: stats.totalAwards, accent: '#111827' },
          { label: t('Points Granted'), value: stats.totalPoints, accent: '#E8321A' },
          { label: t('This Month'), value: stats.thisMonth, accent: '#10B981' },
        ].map((card) => (
          <div key={card.label} className="hr-stat-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: card.accent }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="hr-surface-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>{t('Recognition Momentum Board')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>{t('Keep appreciation visible, track award cadence, and spot who is driving team impact.')}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: t('Recognized Teammates'), value: recognitionBoard.recognizedEmployees, accent: '#111827' },
            { label: t('Average Points'), value: recognitionBoard.averagePoints, accent: '#E8321A' },
            { label: t('Top Category'), value: t(recognitionBoard.topCategory), accent: '#10B981' },
          ].map((card) => (
            <div key={card.label} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '14px 15px', background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.accent }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)', marginBottom: 8 }}>{t('Category Balance')}</div>
            {recognitionBoard.categories.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '18px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No recognition insights yet. Share the first award to start the momentum board.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {recognitionBoard.categories.map((item) => (
                  <div key={item.category} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)' }}>{t(item.category)}</div>
                      <Badge label={`${item.count} ${t('awards')}`} color={CATEGORY_COLORS[item.category] || 'gray'} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6 }}>{item.points} {t('Points')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)', marginBottom: 4 }}>{t('Recognition Spotlight')}</div>
            <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 12 }}>{t('People receiving the most recognition and appreciation momentum right now.')}</p>

            {recognitionBoard.people.length === 0 ? (
              <div className="hr-soft-empty" style={{ padding: '18px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', fontWeight: 600 }}>{t('No recognition insights yet. Share the first award to start the momentum board.')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {recognitionBoard.people.map((person) => (
                  <div key={person.key} style={{ border: '1px solid #EAECF0', borderRadius: 14, padding: '12px 14px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--gray-900)' }}>{person.employeeName}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{person.team || '—'}</div>
                      </div>
                      <Badge label={`${person.count} ${t('awards')}`} color="green" />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      <Badge label={`${person.points} ${t('Points')}`} color="accent" />
                      {person.lastDate ? <Badge label={`${t('Last award')}: ${person.lastDate}`} color="gray" /> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="hr-surface-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('Create Recognition Award')}</h3>
          <Input label={t('Employee ID')} value={form.employeeID} onChange={(e) => setForm((prev) => ({ ...prev, employeeID: e.target.value }))} placeholder="EMP12345" />
          <Input label={t('Title')} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t('Sprint Hero')} />

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-500)', marginBottom: 6 }}>{t('Category')}</label>
            <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #E5E7EB', marginBottom: 12 }}>
              {['Achievement', 'Appreciation', 'Innovation', 'Teamwork', 'Leadership'].map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label={t('Recognition Date')} type="date" value={form.recognitionDate} onChange={(e) => setForm((prev) => ({ ...prev, recognitionDate: e.target.value }))} />
            <Input label={t('Points')} type="number" value={form.points} onChange={(e) => setForm((prev) => ({ ...prev, points: e.target.value }))} />
          </div>

          <Textarea label={t('Message')} value={form.message} onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))} placeholder={t('Thank the employee and describe the impact of their work')} />

          <Btn onClick={handleCreate} disabled={submitting} style={{ width: '100%' }}>
            {submitting ? t('Saving...') : t('Share Recognition')}
          </Btn>
        </div>

        <div className="hr-table-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #F3F4F6' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t('Recognition Feed')}</h3>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : awards.length === 0 ? (
            <div style={{ padding: 24, color: 'var(--gray-500)' }}>{t('No awards shared yet.')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)' }}>
                    {['Employee', 'Award', 'Category', 'Points', 'Date', 'Recognized By'].map((head) => (
                      <th key={head} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)' }}>{t(head)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {awards.map((award) => (
                    <tr key={award.awardID}>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{award.employeeName || award.employeeID}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{award.team || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>
                        <div style={{ fontWeight: 700 }}>{award.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{award.message || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}><Badge label={t(award.category)} color={CATEGORY_COLORS[award.category] || 'gray'} /></td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', fontWeight: 700, color: 'var(--red)' }}>{award.points || 0}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{award.recognitionDate || '—'}</td>
                      <td style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6' }}>{award.recognizedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
