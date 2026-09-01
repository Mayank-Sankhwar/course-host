-- CreateTable
CREATE TABLE "CourseActivity" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lastProgressAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseActivity_courseId_learnerId_key" ON "CourseActivity"("courseId", "learnerId");
CREATE UNIQUE INDEX "CourseActivity_learnerId_courseId_key" ON "CourseActivity"("learnerId", "courseId");
CREATE INDEX "CourseActivity_courseId_lastProgressAt_idx" ON "CourseActivity"("courseId", "lastProgressAt");

-- AddForeignKey
ALTER TABLE "CourseActivity" ADD CONSTRAINT "CourseActivity_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseActivity" ADD CONSTRAINT "CourseActivity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CourseActivity" ADD CONSTRAINT "CourseActivity_learnerId_courseId_fkey" FOREIGN KEY ("courseId", "learnerId") REFERENCES "Enrollment"("courseId", "learnerId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertDismissal" ADD CONSTRAINT "AlertDismissal_learnerId_courseId_fkey" FOREIGN KEY ("courseId", "learnerId") REFERENCES "CourseActivity"("courseId", "learnerId") ON DELETE CASCADE ON UPDATE CASCADE;
