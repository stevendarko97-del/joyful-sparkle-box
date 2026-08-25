import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { validate, teacherAvailabilitySchema, teacherProfileSchema } from '../validation';

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
      WHERE t.is_active = true AND t.verification_status = 'verified'
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
    // Only verified teachers are visible publicly; non-verified are accessible only to themselves
    if (t.verification_status !== 'verified') {
      return res.status(404).json({ error: 'Teacher not found or not yet verified' });
    }
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

// PUT /api/teacher/availability
router.put('/teacher/availability', requireAuth, validate(teacherAvailabilitySchema), async (req: Request, res: Response): Promise<any> => {
  const client = await pool.connect();
  try {
    const userId = (req as any).user.id;
    const rawAvailability = req.body.availability || [];

    await client.query('BEGIN');
    await client.query('DELETE FROM teacher_availability WHERE teacher_id = $1', [userId]);

    const seen = new Set<string>();
    for (const slot of rawAvailability) {
      const day = Number(slot.day_of_week);
      const start = Number(slot.start_hour);
      const end = Number(slot.end_hour);
      const key = `${day}-${start}`;

      if (start < end && day >= 0 && day <= 6 && !seen.has(key)) {
        seen.add(key);
        await client.query(
          `INSERT INTO teacher_availability (teacher_id, day_of_week, start_hour, end_hour)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (teacher_id, day_of_week, start_hour)
           DO UPDATE SET end_hour = EXCLUDED.end_hour`,
          [userId, day, start, end]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Availability schedule saved successfully', count: seen.size });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/teacher/profile
router.put('/teacher/profile', requireAuth, validate(teacherProfileSchema), async (req: Request, res: Response): Promise<any> => {
  const client = await pool.connect();
  try {
    const userId = (req as any).user.id;
    const { headline, bio, phone, rate, years, primarySubject, location, examTypes, selectedTopics, specialties } = req.body;

    await client.query('BEGIN');

    // 1. Update profiles table (bio, phone)
    await client.query(
      `UPDATE profiles SET bio = COALESCE($1, bio), phone = COALESCE($2, phone) WHERE id = $3`,
      [bio || null, phone || null, userId]
    );

    // 2. Upsert teacher_profiles table
    const hourlyRateCents = rate !== undefined && rate !== null ? Math.round(Number(rate) * 100) : 4000;
    const primarySubUuid = primarySubject && primarySubject !== '' ? primarySubject : null;

    await client.query(
      `INSERT INTO teacher_profiles (user_id, headline, hourly_rate_cents, years_experience, primary_subject_id, location, exam_types)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET
         headline = EXCLUDED.headline,
         hourly_rate_cents = EXCLUDED.hourly_rate_cents,
         years_experience = EXCLUDED.years_experience,
         primary_subject_id = EXCLUDED.primary_subject_id,
         location = EXCLUDED.location,
         exam_types = EXCLUDED.exam_types`,
      [userId, headline || null, hourlyRateCents, years || 0, primarySubUuid, location || null, JSON.stringify(examTypes || [])]
    );

    // 3. Update teacher_topics
    await client.query('DELETE FROM teacher_topics WHERE teacher_id = $1', [userId]);
    if (Array.isArray(selectedTopics) && selectedTopics.length > 0) {
      const specSet = new Set(specialties || []);
      for (const topicId of selectedTopics) {
        const isSpecialty = specSet.has(topicId);
        await client.query(
          `INSERT INTO teacher_topics (teacher_id, topic_id, is_specialty) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [userId, topicId, isSpecialty]
        );
      }
    }

    // 4. Update tutor_subjects
    await client.query('DELETE FROM tutor_subjects WHERE teacher_id = $1', [userId]);
    if (primarySubUuid) {
      await client.query(
        `INSERT INTO tutor_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, primarySubUuid]
      );
    }
    if (Array.isArray(selectedTopics) && selectedTopics.length > 0) {
      await client.query(
        `INSERT INTO tutor_subjects (teacher_id, subject_id)
         SELECT DISTINCT $1, subject_id FROM topics WHERE id = ANY($2::uuid[])
         ON CONFLICT DO NOTHING`,
        [userId, selectedTopics]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Profile updated successfully' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
