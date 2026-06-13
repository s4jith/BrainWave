import { NotesRepository } from "@repositories/NotesRepository";

export const NotesService = {
  list: NotesRepository.list.bind(NotesRepository),
  create: NotesRepository.create.bind(NotesRepository),
  update: NotesRepository.update.bind(NotesRepository),
  remove: NotesRepository.remove.bind(NotesRepository),
  listPdfs: NotesRepository.listPdfs.bind(NotesRepository),
};
