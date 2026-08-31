import { useEffect, useState } from 'react';
import { learnerApi, type CourseProgress, type LearnerCourse, type LearnerLesson } from './learner-api';

type EnrolledCourse = { enrollment: { id: string; courseId: string }; course: LearnerCourse; progress: CourseProgress };

export function LearnerManager() {
  const [available, setAvailable] = useState<LearnerCourse[]>([]);
  const [enrolled, setEnrolled] = useState<EnrolledCourse[]>([]);
  const [selected, setSelected] = useState<EnrolledCourse | null>(null);
  const [lessons, setLessons] = useState<LearnerLesson[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLists() {
    try {
      const [availableResponse, enrolledResponse] = await Promise.all([learnerApi.availableCourses(), learnerApi.enrolledCourses()]);
      setAvailable(availableResponse.courses);
      setEnrolled(enrolledResponse.courses);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load learner courses.');
    }
  }

  useEffect(() => { void loadLists(); }, []);

  async function enroll(courseId: string) {
    setError(null);
    try {
      await learnerApi.enroll(courseId);
      await loadLists();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to enroll.');
    }
  }

  async function openCourse(course: EnrolledCourse) {
    setError(null);
    try {
      const response = await learnerApi.lessons(course.course.id);
      setSelected(course);
      setLessons(response.lessons);
      setCourseProgress(response.courseProgress);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to open course.');
    }
  }

  async function progressAction(lessonId: string, action: 'start' | 'complete') {
    if (!selected) return;
    setError(null);
    try {
      await learnerApi.progressAction(selected.course.id, lessonId, action);
      const [progressResponse] = await Promise.all([learnerApi.progress(selected.course.id), loadLists()]);
      setLessons(progressResponse.lessons);
      setCourseProgress(progressResponse.courseProgress);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to record lesson progress.');
    }
  }

  const enrolledCourseIds = new Set(enrolled.map((item) => item.course.id));
  return <section>
    <h2>Available published courses</h2>
    {error && <p role="alert">{error}</p>}
    <ul>{available.map((course) => <li key={course.id}><strong>{course.title}</strong> — {course.category} {!enrolledCourseIds.has(course.id) && <button onClick={() => void enroll(course.id)}>Enroll</button>}</li>)}</ul>
    <h2>My courses</h2>
    <ul>{enrolled.map((item) => <li key={item.enrollment.id}><strong>{item.course.title}</strong> — {item.course.status} — {item.progress.completionPercentage}% <button onClick={() => void openCourse(item)}>Open</button></li>)}</ul>
    {selected && <section>
      <h3>{selected.course.title}</h3>
      {courseProgress && <p>Course progress: {courseProgress.state} ({courseProgress.completedLessons}/{courseProgress.totalLessons}, {courseProgress.completionPercentage}%)</p>}
      <ol>{lessons.map((lesson) => <li key={lesson.id}><strong>{lesson.title}</strong> — {lesson.progressState} <button onClick={() => void progressAction(lesson.id, 'start')}>Start</button> <button onClick={() => void progressAction(lesson.id, 'complete')}>Complete</button></li>)}</ol>
    </section>}
  </section>;
}
