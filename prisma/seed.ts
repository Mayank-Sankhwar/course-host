import 'dotenv/config';
import { ActivityType, CourseStatus, EnrollmentProgressState, PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../apps/server/src/auth/password.js';

const prisma = new PrismaClient();
const developmentInstructorPassword = 'CourseHostDev123!';
const instructorPassword = '12345678i';
const learnerPassword = '12345678l';
// Fixed reference time keeps both the seeded dates and idempotency lookups stable.
const referenceNow = new Date('2026-09-03T12:00:00.000Z');

const localInstructors = ['instructor.a@coursehost.local', 'instructor.b@coursehost.local'] as const;
const letters = 'abcdefghijklmnopqrstuvwxyz';
const instructorEmails = Array.from({ length: 10 }, (_, index) => `instructor${letters[index]}@gmail.com`);
const categories = ['Web Development', 'Backend Development', 'Frontend Development', 'Database', 'Cloud Computing', 'DevOps', 'Kubernetes', 'System Design', 'Programming', 'Java', 'JavaScript', 'TypeScript', 'Python', 'Data Structures', 'Software Engineering'];

type CourseTemplate = { title: string; description: string; category: string };
const courseTemplates: CourseTemplate[] = [
  ['Accessible Web Interfaces', 'Build inclusive, semantic web interfaces with practical accessibility techniques.', 'Web Development'],
  ['JavaScript for Product Teams', 'Use modern JavaScript patterns to build maintainable user-facing features.', 'JavaScript'],
  ['Practical PostgreSQL', 'Design reliable relational data models and write effective PostgreSQL queries.', 'Database'],
  ['Cloud Foundations on AWS', 'Understand cloud building blocks, networking, storage, and deployment choices.', 'Cloud Computing'],
  ['TypeScript in Production', 'Create safer JavaScript applications with TypeScript types and tooling.', 'TypeScript'],
  ['Docker and Deployment Basics', 'Package services with Docker and deploy them with confidence.', 'DevOps'],
  ['React Component Architecture', 'Structure React components, state, and reusable UI patterns for real products.', 'Frontend Development'],
  ['Node.js API Design', 'Build dependable HTTP APIs with validation, error handling, and observability.', 'Backend Development'],
  ['Python Automation Workshop', 'Automate repeatable engineering tasks with practical Python scripts.', 'Python'],
  ['Data Structures Made Useful', 'Apply arrays, trees, graphs, and hash maps to everyday programming problems.', 'Data Structures'],
  ['Java Fundamentals', 'Develop a solid understanding of object-oriented programming with Java.', 'Java'],
  ['System Design Essentials', 'Make clear, scalable architecture decisions for backend systems.', 'System Design'],
  ['CSS Layout and Design Systems', 'Create responsive layouts and consistent visual systems with modern CSS.', 'Frontend Development'],
  ['SQL Performance Tuning', 'Investigate slow queries and improve database performance methodically.', 'Database'],
  ['Kubernetes for Application Teams', 'Deploy, observe, and troubleshoot applications running on Kubernetes.', 'Kubernetes'],
  ['Secure Authentication Patterns', 'Learn practical authentication, session, and authorization design principles.', 'Software Engineering'],
  ['REST APIs with Express', 'Build clear, testable APIs using Express and proven HTTP conventions.', 'Backend Development'],
  ['Modern HTML and CSS', 'Create polished responsive pages using semantic HTML and maintainable CSS.', 'Web Development'],
  ['Git Collaboration Essentials', 'Use branches, pull requests, and code review workflows effectively.', 'Software Engineering'],
  ['Testing JavaScript Applications', 'Write useful unit and integration tests for JavaScript services.', 'JavaScript'],
  ['Algorithms for Interviews', 'Practice algorithmic thinking with common interview-ready problem patterns.', 'Programming'],
  ['Event-Driven Systems', 'Model asynchronous workflows with events, queues, and resilient consumers.', 'System Design'],
  ['Python Data Processing', 'Clean, transform, and validate structured data with Python.', 'Python'],
  ['Java Collections in Practice', 'Choose and use Java collection types for readable, efficient code.', 'Java'],
  ['Frontend Performance Fundamentals', 'Measure and improve browser performance without premature optimization.', 'Frontend Development'],
  ['Database Design Workshop', 'Translate product requirements into normalized, durable database schemas.', 'Database'],
  ['Linux for Developers', 'Navigate Linux environments, manage processes, and automate daily tasks.', 'DevOps'],
  ['Building with Kubernetes', 'Use deployments, services, configuration, and health checks in Kubernetes.', 'Kubernetes'],
  ['API Security Fundamentals', 'Protect APIs with safe input handling, access controls, and secure defaults.', 'Backend Development'],
  ['Full Stack TypeScript', 'Connect typed frontend and backend systems in a modern TypeScript workflow.', 'TypeScript'],
  ['Responsive Interface Design', 'Plan layouts that remain useful across mobile, tablet, and desktop screens.', 'Web Development'],
  ['JavaScript Async Patterns', 'Master promises, async functions, and dependable network request flows.', 'JavaScript'],
  ['Cloud Cost Awareness', 'Make practical infrastructure choices that balance reliability and cost.', 'Cloud Computing'],
  ['Observability for Services', 'Use logs, metrics, and traces to understand production service behavior.', 'DevOps'],
  ['Object-Oriented Java', 'Model domain problems cleanly with Java classes, interfaces, and tests.', 'Java'],
  ['Architecture Decision Records', 'Communicate technical decisions with concise, durable architecture records.', 'Software Engineering'],
  ['Advanced React State', 'Choose effective state boundaries and data-flow patterns in React apps.', 'Frontend Development'],
  ['Relational Data Modeling', 'Model relationships, constraints, and lifecycle data in SQL databases.', 'Database'],
  ['Distributed Systems Basics', 'Understand consistency, retries, timeouts, and failure modes in distributed systems.', 'System Design'],
  ['Python Web Services', 'Create readable, tested Python services that expose HTTP APIs.', 'Python'],
  ['Web API Integration', 'Connect browser interfaces to dependable APIs and handle failure states.', 'Web Development'],
  ['Clean Code in JavaScript', 'Refactor JavaScript code toward clarity, cohesion, and maintainability.', 'Programming'],
  ['Containers and CI Pipelines', 'Automate builds, tests, and container delivery in a CI workflow.', 'DevOps'],
  ['Graph Algorithms', 'Explore traversal, shortest paths, and graph modeling with worked examples.', 'Data Structures'],
  ['Java Concurrency Basics', 'Build an understanding of threads, executors, and safe shared state.', 'Java'],
  ['Type-Safe API Clients', 'Use TypeScript to create safer, easier-to-maintain API client code.', 'TypeScript'],
  ['Productive SQL Reporting', 'Build accurate reports and aggregates from operational data.', 'Database'],
  ['Cloud Networking Explained', 'Understand virtual networks, routing, security groups, and service connectivity.', 'Cloud Computing'],
  ['Kubernetes Troubleshooting', 'Diagnose workload, networking, and configuration issues in Kubernetes.', 'Kubernetes'],
  ['Software Delivery Practices', 'Improve delivery with small changes, feedback loops, and reliable releases.', 'Software Engineering'],
  ['Practical Programming Patterns', 'Recognize useful design patterns and apply them without overengineering.', 'Programming'],
  ['Modern CSS Techniques', 'Use grid, flexbox, CSS variables, and container-aware design effectively.', 'Frontend Development'],
  ['Reliable Node.js Services', 'Design Node.js services for error recovery, monitoring, and steady operation.', 'Backend Development'],
  ['Python Testing Foundations', 'Test Python code with fixtures, assertions, and clear test boundaries.', 'Python'],
  ['Scalable API Architecture', 'Design APIs that evolve safely as product and integration needs grow.', 'System Design'],
  ['JavaScript Debugging Skills', 'Debug browser and server JavaScript with repeatable investigation techniques.', 'JavaScript'],
  ['Web Security Essentials', 'Identify common web risks and use pragmatic defensive engineering habits.', 'Web Development'],
  ['Database Migrations Safely', 'Plan and execute database schema changes while protecting production data.', 'Database'],
  ['Cloud Application Reliability', 'Build reliable cloud applications with health checks, redundancy, and recovery.', 'Cloud Computing']
].map(([title, description, category]) => ({ title, description, category }));

const commentPhrases = [
  'The walkthrough made the main concept much easier to apply in practice.',
  'I found the example useful and will try this approach in my next project.',
  'The distinction between the trade-offs is especially clear here.',
  'Thanks for the practical explanation and the suggested next steps.',
  'This helped me connect the topic to a problem I have been working on.'
];

function learnerLabel(index: number) {
  let value = index + 1;
  let label = '';
  while (value > 0) { value -= 1; label = letters[value % 26] + label; value = Math.floor(value / 26); }
  return label;
}
function seeded(seed: number) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 0x1_0000_0000; };
}
function daysAgo(days: number) { return new Date(referenceNow.getTime() - days * 86_400_000); }
function daysAfter(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }
function earlier(date: Date, latest: Date) { return date.getTime() > latest.getTime() ? new Date(latest.getTime() - 3_600_000) : date; }
function lessonOutline(template: CourseTemplate, count: number) {
  const shared = ['Introduction and course overview', 'Core concepts and terminology', 'Guided implementation', 'Common mistakes and debugging', 'Applied practice', 'Review and next steps', 'Production considerations', 'Capstone exercise'];
  const topic = template.category === 'Database' ? ['Data modeling foundations', 'Query fundamentals', 'Indexes and performance', 'Transactions and consistency', 'Reporting and aggregates', 'Schema evolution', 'Operational practices', 'Applied database exercise']
    : template.category === 'Kubernetes' ? ['Cluster concepts', 'Workloads and deployments', 'Services and networking', 'Configuration and secrets', 'Observability', 'Troubleshooting workflows', 'Release strategies', 'Operational exercise']
      : template.category === 'Frontend Development' ? ['Interface foundations', 'Component composition', 'State and data flow', 'Responsive behavior', 'Accessibility checks', 'Performance considerations', 'Testing the interface', 'Applied interface exercise']
        : shared;
  return topic.slice(0, count).map((name, index) => ({ title: `${name}: ${template.title}`, content: `${name}. This lesson develops a practical part of ${template.title}. Work through the concepts, consider the trade-offs, and apply the technique to a realistic engineering scenario.` }));
}

type Counts = Record<'instructors' | 'learners' | 'courses' | 'lessons' | 'enrollments' | 'progress' | 'comments' | 'logs', { created: number; found: number }>;
const counts: Counts = Object.fromEntries(['instructors', 'learners', 'courses', 'lessons', 'enrollments', 'progress', 'comments', 'logs'].map((key) => [key, { created: 0, found: 0 }])) as Counts;
function count(kind: keyof Counts, created: boolean) { counts[kind][created ? 'created' : 'found'] += 1; }

async function upsertLog(courseId: string, actorId: string | null, type: ActivityType, createdAt: Date) {
  const existing = await prisma.activityLog.findFirst({ where: { courseId, actorId, type, createdAt }, select: { id: true } });
  if (existing) { count('logs', false); return; }
  await prisma.activityLog.create({ data: { courseId, actorId, type, createdAt } }); count('logs', true);
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('The development seed cannot run in production.');
  const [localHash, instructorHash, learnerHash] = await Promise.all([hashPassword(developmentInstructorPassword), hashPassword(instructorPassword), hashPassword(learnerPassword)]);

  for (const email of localInstructors) await prisma.user.upsert({ where: { email }, update: { role: Role.INSTRUCTOR, passwordHash: localHash }, create: { email, role: Role.INSTRUCTOR, passwordHash: localHash } });

  const instructors = [] as { id: string; email: string }[];
  for (const email of instructorEmails) {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const user = await prisma.user.upsert({ where: { email }, update: { role: Role.INSTRUCTOR, passwordHash: instructorHash }, create: { email, role: Role.INSTRUCTOR, passwordHash: instructorHash }, select: { id: true, email: true } });
    count('instructors', !existing); instructors.push(user);
  }
  const learners = [] as { id: string; email: string }[];
  for (let index = 0; index < 100; index += 1) {
    const label = learnerLabel(index); const email = `learner${label}@gmail.com`;
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const user = await prisma.user.upsert({ where: { email }, update: { role: Role.LEARNER, passwordHash: learnerHash }, create: { email, role: Role.LEARNER, passwordHash: learnerHash }, select: { id: true, email: true } });
    count('learners', !existing); learners.push(user);
  }

  const courses: { id: string; instructorId: string; status: CourseStatus; createdAt: Date; template: CourseTemplate; lessons: { id: string; position: number; createdAt: Date }[] }[] = [];
  for (let instructorIndex = 0; instructorIndex < instructors.length; instructorIndex += 1) {
    for (let slot = 0; slot < 6; slot += 1) {
      const courseIndex = instructorIndex * 6 + slot; const template = courseTemplates[courseIndex % courseTemplates.length]; const instructor = instructors[instructorIndex];
      const status = slot === 5 ? CourseStatus.ARCHIVED : slot === 4 || (instructorIndex < 4 && slot === 3) ? CourseStatus.DRAFT : CourseStatus.PUBLISHED;
      const createdAt = daysAgo(70 + ((courseIndex * 11) % 210));
      const existing = await prisma.course.findFirst({ where: { instructorId: instructor.id, title: template.title }, select: { id: true } });
      const course = existing ? await prisma.course.update({ where: { id: existing.id }, data: { description: template.description, category: template.category, status, createdAt, updatedAt: daysAfter(createdAt, 1) }, select: { id: true, createdAt: true } })
        : await prisma.course.create({ data: { instructorId: instructor.id, title: template.title, description: template.description, category: template.category, status, createdAt, updatedAt: daysAfter(createdAt, 1) }, select: { id: true, createdAt: true } });
      count('courses', !existing); await upsertLog(course.id, instructor.id, ActivityType.COURSE_CREATED, course.createdAt);
      const lessonCount = 6 + (courseIndex % 3); const outline = lessonOutline(template, lessonCount); const lessons = [] as { id: string; position: number; createdAt: Date }[];
      await prisma.lesson.deleteMany({ where: { courseId: course.id, position: { gt: lessonCount } } });
      for (let position = 1; position <= lessonCount; position += 1) {
        const lessonCreatedAt = daysAfter(course.createdAt, position); const existingLesson = await prisma.lesson.findUnique({ where: { courseId_position: { courseId: course.id, position } }, select: { id: true } });
        const lesson = await prisma.lesson.upsert({ where: { courseId_position: { courseId: course.id, position } }, update: { title: outline[position - 1].title, content: outline[position - 1].content }, create: { courseId: course.id, position, title: outline[position - 1].title, content: outline[position - 1].content, createdAt: lessonCreatedAt, updatedAt: lessonCreatedAt }, select: { id: true, createdAt: true } });
        count('lessons', !existingLesson); lessons.push({ id: lesson.id, position, createdAt: lesson.createdAt }); await upsertLog(course.id, instructor.id, ActivityType.LESSON_CREATED, lesson.createdAt);
      }
      if (status !== CourseStatus.DRAFT) await upsertLog(course.id, instructor.id, ActivityType.COURSE_PUBLISHED, daysAfter(course.createdAt, lessonCount + 1));
      if (courseIndex % 7 === 0) await upsertLog(course.id, instructor.id, ActivityType.COURSE_UPDATED, daysAfter(course.createdAt, lessonCount + 3));
      if (status === CourseStatus.ARCHIVED) await upsertLog(course.id, instructor.id, ActivityType.COURSE_ARCHIVED, daysAfter(course.createdAt, lessonCount + 45));
      else if (courseIndex % 11 === 0) { await upsertLog(course.id, instructor.id, ActivityType.COURSE_ARCHIVED, daysAfter(course.createdAt, lessonCount + 20)); await upsertLog(course.id, instructor.id, ActivityType.COURSE_RESTORED, daysAfter(course.createdAt, lessonCount + 23)); }
      courses.push({ id: course.id, instructorId: instructor.id, status, createdAt: course.createdAt, template, lessons });
    }
  }

  const eligibleCourses = courses.filter((course) => course.status !== CourseStatus.DRAFT);
  let enrollmentSequence = 0;
  for (let learnerIndex = 0; learnerIndex < learners.length; learnerIndex += 1) {
    const random = seeded(8_000 + learnerIndex); const desired = 1 + Math.floor(random() * 6); const selected = new Set<number>();
    while (selected.size < desired) selected.add(Math.floor(random() * eligibleCourses.length));
    for (const courseIndex of selected) {
      const course = eligibleCourses[courseIndex]; const learner = learners[learnerIndex]; const stateBucket = (enrollmentSequence * 37 + 11) % 100;
      const progressState = stateBucket < 35 ? EnrollmentProgressState.NOT_STARTED : stateBucket < 75 ? EnrollmentProgressState.IN_PROGRESS : EnrollmentProgressState.COMPLETED;
      const enrollmentAt = earlier(daysAfter(course.createdAt, 8 + (enrollmentSequence % 48)), daysAgo(2));
      const completionAt = progressState === EnrollmentProgressState.COMPLETED ? earlier(daysAgo(2 + ((enrollmentSequence % 8) * 7)), daysAgo(1)) : null;
      const existing = await prisma.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: learner.id, courseId: course.id } }, select: { id: true } });
      const enrollment = await prisma.enrollment.upsert({ where: { learnerId_courseId: { learnerId: learner.id, courseId: course.id } }, update: { progressState, completedAt: completionAt }, create: { learnerId: learner.id, courseId: course.id, progressState, enrolledAt: enrollmentAt, completedAt: completionAt, updatedAt: completionAt ?? enrollmentAt }, select: { id: true } });
      count('enrollments', !existing); await upsertLog(course.id, course.instructorId, ActivityType.LEARNER_ENROLLED, enrollmentAt);
      if (progressState !== EnrollmentProgressState.NOT_STARTED) {
        const completedCount = progressState === EnrollmentProgressState.COMPLETED ? course.lessons.length : 1 + (enrollmentSequence % Math.max(1, course.lessons.length - 1));
        const inactivityDays = [2, 6, 9, 14, 15, 17, 20, 26, 35][enrollmentSequence % 9];
        const lastProgressAt = progressState === EnrollmentProgressState.COMPLETED ? completionAt! : daysAgo(inactivityDays);
        for (const lesson of course.lessons) {
          if (lesson.position > completedCount + (progressState === EnrollmentProgressState.IN_PROGRESS ? 1 : 0)) break;
          const isCompleted = progressState === EnrollmentProgressState.COMPLETED || lesson.position <= completedCount;
          const startedAt = earlier(daysAfter(enrollmentAt, lesson.position + 1), lastProgressAt);
          const completedAt = isCompleted ? earlier(daysAfter(startedAt, 1), lastProgressAt) : null;
          const existingProgress = await prisma.lessonProgress.findUnique({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } }, select: { id: true } });
          await prisma.lessonProgress.upsert({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: lesson.id } }, update: { startedAt, completedAt }, create: { enrollmentId: enrollment.id, lessonId: lesson.id, startedAt, completedAt, updatedAt: completedAt ?? startedAt } });
          count('progress', !existingProgress);
        }
        await prisma.courseActivity.upsert({ where: { courseId_learnerId: { courseId: course.id, learnerId: learner.id } }, update: { lastProgressAt }, create: { courseId: course.id, learnerId: learner.id, lastProgressAt, createdAt: lastProgressAt, updatedAt: lastProgressAt } });
        if (progressState === EnrollmentProgressState.COMPLETED) await upsertLog(course.id, learner.id, ActivityType.LESSON_COMPLETED, lastProgressAt);
      } else await prisma.courseActivity.deleteMany({ where: { courseId: course.id, learnerId: learner.id } });
      enrollmentSequence += 1;
    }
  }

  for (let courseIndex = 0; courseIndex < courses.length; courseIndex += 1) {
    const course = courses[courseIndex]; if (course.status === CourseStatus.DRAFT || courseIndex % 3 !== 0) continue;
    const enrolled = await prisma.enrollment.findMany({ where: { courseId: course.id }, select: { learnerId: true }, take: 3, orderBy: { learnerId: 'asc' } });
    const authors = [course.instructorId, ...enrolled.map((entry) => entry.learnerId)];
    for (let index = 0; index < Math.min(authors.length, 2 + (courseIndex % 3)); index += 1) {
      const content = `${commentPhrases[(courseIndex + index) % commentPhrases.length]} (${course.template.title})`;
      const createdAt = daysAfter(course.createdAt, 18 + index * 3);
      const existing = await prisma.comment.findFirst({ where: { courseId: course.id, authorId: authors[index], content }, select: { id: true, createdAt: true } });
      const comment = existing ?? await prisma.comment.create({ data: { courseId: course.id, authorId: authors[index], content, createdAt, updatedAt: createdAt }, select: { id: true, createdAt: true } });
      count('comments', !existing); await upsertLog(course.id, authors[index], ActivityType.COMMENT_CREATED, comment.createdAt);
    }
  }

  const managedCourseIds = courses.map((course) => course.id);
  const stateGroups = await prisma.enrollment.groupBy({ by: ['progressState'], where: { courseId: { in: managedCourseIds } }, _count: { _all: true } });
  const [instructorTotal, learnerTotal, courseTotal, enrollmentTotal, commentTotal, logTotal] = await Promise.all([
    prisma.user.count({ where: { role: Role.INSTRUCTOR } }), prisma.user.count({ where: { role: Role.LEARNER } }), prisma.course.count(), prisma.enrollment.count(), prisma.comment.count(), prisma.activityLog.count()
  ]);
  const lessonRange = await prisma.lesson.groupBy({ by: ['courseId'], where: { courseId: { in: managedCourseIds } }, _count: { _all: true } });
  const inactive = await prisma.courseActivity.count({ where: { courseId: { in: managedCourseIds }, lastProgressAt: { lt: daysAgo(14) }, enrollment: { is: { progressState: EnrollmentProgressState.IN_PROGRESS } } } });
  const exactFourteen = await prisma.courseActivity.count({ where: { courseId: { in: managedCourseIds }, lastProgressAt: daysAgo(14), enrollment: { is: { progressState: EnrollmentProgressState.IN_PROGRESS } } } });
  const currentMonth = new Date(Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth(), 1));
  const currentMonthCompletions = await prisma.enrollment.count({ where: { courseId: { in: managedCourseIds }, completedAt: { gte: currentMonth } } });
  const archivedHistorical = await prisma.course.count({ where: { id: { in: managedCourseIds }, status: CourseStatus.ARCHIVED, enrollments: { some: { lessonProgress: { some: {} } } }, activityLog: { some: {} } } });
  console.log('\nCourseHost deterministic demo seed complete');
  for (const [kind, values] of Object.entries(counts)) console.log(`${kind}: ${values.created} created, ${values.found} found`);
  console.log(`Demo dataset: 10 Gmail instructors, 100 Gmail learners, ${courses.length} courses, ${stateGroups.reduce((sum, group) => sum + group._count._all, 0)} enrollments`);
  console.log(`Database totals: ${instructorTotal} instructors, ${learnerTotal} learners, ${courseTotal} courses, ${enrollmentTotal} enrollments`);
  console.log(`Lessons/course: ${Math.min(...lessonRange.map((entry) => entry._count._all))}-${Math.max(...lessonRange.map((entry) => entry._count._all))}`);
  console.log(`Progress: ${stateGroups.map((group) => `${group.progressState}=${group._count._all}`).join(', ')}`);
  console.log(`Inactivity: ${inactive} inactive IN_PROGRESS, ${exactFourteen} exactly 14-day IN_PROGRESS`);
  console.log(`Dashboard: ${currentMonthCompletions} current-month completions; ${archivedHistorical} archived courses with history`);
  console.log(`Discussion/history totals: ${commentTotal} comments, ${logTotal} activity logs`);
  console.log(`Demo logins: instructorA@gmail.com / ${instructorPassword}; learnerA@gmail.com / ${learnerPassword}`);
}

main().catch((error: unknown) => { console.error('Development seed failed.', error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
