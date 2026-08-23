import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// GET /api/subjects
router.get('/subjects', async (_req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM subjects ORDER BY name');
    res.json({ subjects: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/topics
router.get('/topics', async (req: Request, res: Response): Promise<any> => {
  try {
    const { subjectId } = req.query;
    let query = 'SELECT id, name, subject_id FROM topics';
    const params: any[] = [];
    if (subjectId) { query += ' WHERE subject_id = $1'; params.push(subjectId); }
    query += ' ORDER BY name';
    const { rows } = await pool.query(query, params);
    res.json({ topics: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/teachers
router.get('/teachers', async (req: Request, res: Response): Promise<any> => {
  try {
    const { subjectId, examType, location, maxPrice } = req.query;
    let query = `
      SELECT t.user_id, t.video_url as headline, t.hourly_rate_cents, t.location, t.exam_types, t.verification_status,
             t.years_experience, p.full_name, p.avatar_url, s.name as subject_name
      FROM teacher_profiles t
      LEFT JOIN profiles p ON t.user_id = p.id
      LEFT JOIN subjects s ON t.primary_subject_id = s.id
      WHERE t.is_active = true
    `;
    const params: any[] = [];
    let i = 1;
    if (subjectId) { query += ` AND t.primary_subject_id = $${i++}`; params.push(subjectId); }
    if (examType) { query += ` AND t.exam_types::text LIKE $${i++}`; params.push(`%${examType}%`); }
    if (location) { query += ` AND t.location = $${i++}`; params.push(location); }
    if (maxPrice) { query += ` AND t.hourly_rate_cents <= $${i++}`; params.push(parseInt(maxPrice as string) * 100); }

    const { rows: teachers } = await pool.query(query, params);

    if (teachers.length > 0) {
      const ids = teachers.map((t) => t.user_id);
      const [{ rows: ratings }, { rows: topicsRows }] = await Promise.all([
        pool.query('SELECT teacher_id, stars FROM ratings WHERE teacher_id = ANY($1::uuid[])', [ids]),
        pool.query(`
          SELECT tt.teacher_id, tt.is_specialty, tp.id as topic_id, tp.name as topic_name
          FROM teacher_topics tt
          JOIN topics tp ON tt.topic_id = tp.id
          WHERE tt.teacher_id = ANY($1::uuid[])
          ORDER BY tt.is_specialty DESC, tp.name ASC
        `, [ids]),
      ]);

      const agg = new Map<string, { sum: number; n: number }>();
      ratings.forEach((r) => { const a = agg.get(r.teacher_id) || { sum: 0, n: 0 }; a.sum += Number(r.stars) || 0; a.n++; agg.set(r.teacher_id, a); });

      const topicsMap = new Map<string, Array<{ id: string; name: string; is_specialty: boolean }>>();
      topicsRows.forEach((row) => { const list = topicsMap.get(row.teacher_id) || []; list.push({ id: row.topic_id, name: row.topic_name, is_specialty: row.is_specialty }); topicsMap.set(row.teacher_id, list); });

      teachers.forEach((t) => {
        const a = agg.get(t.user_id);
        t.avg_stars = a && a.n > 0 ? Number((a.sum / a.n).toFixed(1)) : null;
        t.review_count = a?.n ?? 0;
        t.profiles = { full_name: t.full_name, avatar_url: t.avatar_url };
        t.subjects = { name: t.subject_name };
        t.topics = topicsMap.get(t.user_id) || [];
      });
    }
    res.json({ teachers });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/teachers/:id
router.get('/teachers/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const [{ rows: tp }, { rows: topics }, { rows: availability }, { rows: ratings }] = await Promise.all([
      pool.query(`SELECT t.user_id, t.video_url as headline, t.hourly_rate_cents, t.years_experience, t.background as location,
                  t.verification_status, t.exam_types, p.full_name, p.bio, p.avatar_url, s.name as subject_name
                  FROM teacher_profiles t LEFT JOIN profiles p ON t.user_id=p.id LEFT JOIN subjects s ON t.primary_subject_id=s.id
                  WHERE t.user_id=$1`, [req.params.id]),
      pool.query(`SELECT tt.is_specialty, tp.id as topic_id, tp.name as topic_name FROM teacher_topics tt JOIN topics tp ON tt.topic_id=tp.id WHERE tt.teacher_id=$1`, [req.params.id]),
      pool.query('SELECT day_of_week, start_hour, end_hour FROM teacher_availability WHERE teacher_id=$1 ORDER BY day_of_week, start_hour', [req.params.id]),
      pool.query(`SELECT r.id, r.stars, r.comment, r.created_at, b.scheduled_at, b.location, p.full_name as student_name, p.avatar_url as student_avatar
                  FROM ratings r LEFT JOIN bookings b ON r.booking_id=b.id LEFT JOIN profiles p ON r.student_id=p.id
                  WHERE r.teacher_id=$1 ORDER BY r.created_at DESC`, [req.params.id]),
    ]);
    if (!tp.length) return res.status(404).json({ error: 'Teacher not found' });
    const t = tp[0];
    const totalStars = ratings.reduce((sum, r) => sum + (Number(r.stars) || 0), 0);
    const reviewCount = ratings.length;
    const avgStars = reviewCount > 0 ? Number((totalStars / reviewCount).toFixed(1)) : null;
    res.json({
      t: { user_id: t.user_id, headline: t.headline, hourly_rate_cents: t.hourly_rate_cents, years_experience: t.years_experience, location: t.location, verification_status: t.verification_status, exam_types: t.exam_types, avg_stars: avgStars, review_count: reviewCount, profiles: { full_name: t.full_name, bio: t.bio, avatar_url: t.avatar_url }, subjects: { name: t.subject_name } },
      topics: topics.map((tp) => ({ id: tp.topic_id, name: tp.topic_name, is_specialty: tp.is_specialty })),
      availability,
      ratings: ratings.map((r) => ({ id: r.id, stars: r.stars, comment: r.comment, created_at: r.created_at, student_name: r.student_name || 'Verified Student', student_avatar: r.student_avatar || null, bookings: { scheduled_at: r.scheduled_at, location: r.location } })),
      avg_stars: avgStars,
      review_count: reviewCount,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/teacher/:id/availability
router.get('/teacher/:id/availability', async (req: Request, res: Response): Promise<any> => {
  try {
    const { rows } = await pool.query('SELECT day_of_week, start_hour, end_hour FROM teacher_availability WHERE teacher_id=$1 ORDER BY day_of_week', [req.params.id]);
    res.json({ data: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/teacher/:id/bookings-taken
router.get('/teacher/:id/bookings-taken', async (req: Request, res: Response): Promise<any> => {
  try {
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setDate(from.getDate() + 7);
    const { rows } = await pool.query(
      `SELECT scheduled_at FROM bookings WHERE teacher_id=$1 AND status IN ('pending','confirmed') AND scheduled_at >= $2 AND scheduled_at < $3`,
      [req.params.id, from.toISOString(), to.toISOString()]
    );
    res.json({ taken: rows });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
