export type Lesson = {
  id: string;
  courseId: string;
  title: string;
  content: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LessonFields = Pick<Lesson, 'title' | 'content'>;

export type LessonRepository = {
  createAtEnd(courseId: string, input: LessonFields): Promise<Lesson>;
  list(courseId: string): Promise<Lesson[]>;
  findByIdAndCourse(id: string, courseId: string): Promise<Lesson | null>;
  update(id: string, input: Partial<LessonFields>): Promise<Lesson>;
  deleteAndNormalize(courseId: string, lessonId: string): Promise<void>;
  reorder(courseId: string, lessonIds: string[]): Promise<Lesson[]>;
};

export class LastLessonDeletionError extends Error {
  constructor() {
    super('The course must contain at least one lesson.');
  }
}

export class LessonSetMismatchError extends Error {
  constructor() {
    super('lessonIds must exactly match the course lessons.');
  }
}
