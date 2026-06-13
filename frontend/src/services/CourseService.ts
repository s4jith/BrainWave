import { CourseRepository } from "@repositories/CourseRepository";

export const CourseService = {
  list: CourseRepository.list.bind(CourseRepository),
  myCourses: CourseRepository.myCourses.bind(CourseRepository),
  detail: CourseRepository.detail.bind(CourseRepository),
  create: CourseRepository.create.bind(CourseRepository),
  update: CourseRepository.update.bind(CourseRepository),
  publish: CourseRepository.publish.bind(CourseRepository),
  addModule: CourseRepository.addModule.bind(CourseRepository),
};
