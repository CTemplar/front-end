import { Injectable } from '@angular/core';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { Observable, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap } from 'rxjs/operators';

import { MailService } from '../services';
import {
  BlackListGet,
  DeleteFolder,
  DeleteMail,
  DeleteMailForAll,
  DeleteMailForAllSuccess,
  DeleteMailSuccess,
  EmptyFolder,
  EmptyFolderFailure,
  EmptyFolderSuccess,
  GetMailDetail,
  GetMailDetailSuccess,
  GetMailDetailFailure,
  GetMails,
  GetMailsSuccess,
  GetUnreadMailsCount,
  GetUnreadMailsCountSuccess,
  GetCustomFolderMessageCount,
  GetCustomFolderMessageCountSuccess,
  MailActionTypes,
  MoveMail,
  MoveMailSuccess,
  ReadMail,
  ReadMailSuccess,
  SnackErrorPush,
  SnackPush,
  StarMailSuccess,
  UndoDeleteMail,
  UndoDeleteMailSuccess,
} from '../actions';
import { MailFolderType } from '../models';

@Injectable({
  providedIn: 'root',
})
export class MailEffects {
  constructor(private actions: Actions, private mailService: MailService) {}

  @Effect()
  getMailsEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.GET_MAILS),
    map((action: GetMails) => action.payload),
    switchMap(payload => {
      return this.mailService.getMessages(payload).pipe(
        map(response => {
          return new GetMailsSuccess({
            ...payload,
            is_not_first_page: !!response.previous,
            mails: response.results,
            total_mail_count: response.total_count,
            is_from_socket: false,
          });
        }),
        catchError(() => of(new SnackErrorPush({ message: 'Failed to get messages.' }))),
      );
    }),
  );

  @Effect()
  getUnreadMailsCountEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.GET_UNREAD_MAILS_COUNT),
    map((action: GetUnreadMailsCount) => action.payload),
    mergeMap(() => {
      return this.mailService.getUnreadMailsCount().pipe(
        map(response => {
          return new GetUnreadMailsCountSuccess(response);
        }),
        catchError(() => of(new SnackErrorPush({ message: 'Failed to get unread mails count.' }))),
      );
    }),
  );

  @Effect()
  getCustomFolderMessageCountEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.GET_CUSTOMFOLDER_MESSAGE_COUNT),
    map((action: GetCustomFolderMessageCount) => action.payload),
    mergeMap(() => {
      return this.mailService.getCustomFolderMessageCount().pipe(
        map(response => {
          return new GetCustomFolderMessageCountSuccess(response);
        }),
        catchError(() => of(new SnackErrorPush({ message: 'Failed to get custome folder message count.' }))),
      );
    }),
  );

  @Effect()
  moveMailEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.MOVE_MAIL),
    map((action: MoveMail) => action.payload),
    switchMap(payload => {
      return this.mailService
        .moveMail(payload.ids, payload.folder, payload.sourceFolder, payload.withChildren, payload.fromTrash)
        .pipe(
          switchMap(() => {
            const updateFolderActions = [];

            if (payload.shouldDeleteFolder) {
              updateFolderActions.push(new DeleteFolder(payload.folderToDelete));
            }
            updateFolderActions.push(new MoveMailSuccess(payload));
            if (!payload.shouldDeleteFolder) {
              updateFolderActions.push(
                new SnackPush({
                  message: `Mail moved to ${payload.folder}`,
                  ids: payload.ids,
                  folder: payload.folder,
                  sourceFolder: payload.sourceFolder,
                  mail: payload.mail,
                  allowUndo: payload.allowUndo,
                }),
              );
            }
            if (payload.folder === MailFolderType.SPAM) {
              updateFolderActions.push(new BlackListGet());
            }
            return of(...updateFolderActions);
          }),
          catchError(() => of(new SnackErrorPush({ message: `Failed to move mail to ${payload.folder}.` }))),
        );
    }),
  );

  @Effect()
  deleteMailEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.DELETE_MAIL),
    map((action: DeleteMail) => action.payload),
    switchMap(payload => {
      return this.mailService.deleteMails(payload.ids, payload.folder, payload.parent_only).pipe(
        switchMap(() => {
          const updateFolderActions = [];
          updateFolderActions.push(new DeleteMailSuccess(payload));
          if (payload.folder === MailFolderType.DRAFT) {
            updateFolderActions.push(new GetUnreadMailsCount());
          }
          return of(...updateFolderActions);
        }),
        catchError(() => of(new SnackErrorPush({ message: 'Failed to delete mail.' }))),
      );
    }),
  );

  @Effect()
  deleteMailForAllEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.DELETE_MAIL_FOR_ALL),
    map((action: DeleteMailForAll) => action.payload),
    switchMap(payload => {
      return this.mailService.deleteMailForAll(payload.id).pipe(
        switchMap(() =>
          of(new DeleteMailForAllSuccess(payload), new SnackErrorPush({ message: 'Mail deleted successfully.' })),
        ),
        catchError(() => of(new SnackErrorPush({ message: 'Failed to delete mail.' }))),
      );
    }),
  );

  @Effect()
  readMailEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.READ_MAIL),
    map((action: ReadMail) => action.payload),
    switchMap(payload => {
      return payload?.isLocalUpdate
        ? of(new ReadMailSuccess(payload))
        : this.mailService.markAsRead(payload.ids, payload.read, payload.folder).pipe(
            switchMap(() => of(new ReadMailSuccess(payload))),
            catchError(() => of(new SnackErrorPush({ message: 'Failed to mark mail as read.' }))),
          );
    }),
  );

  @Effect()
  starMailEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.STAR_MAIL),
    map((action: ReadMail) => action.payload),
    mergeMap(payload => {
      return this.mailService.markAsStarred(payload.ids, payload.starred, payload.folder, payload.withChildren).pipe(
        switchMap(() => of(new StarMailSuccess(payload))),
        catchError(() => of(new SnackErrorPush({ message: 'Failed to mark as starred.' }))),
      );
    }),
  );

  @Effect()
  getMailDetailEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.GET_MAIL_DETAIL),
    map((action: GetMailDetail) => action.payload),
    switchMap(payload => {
      return this.mailService.getMessage(payload).pipe(
        switchMap(response => of(new GetMailDetailSuccess(response))),
        catchError(error => of(new GetMailDetailFailure(error))),
      );
    }),
  );

  @Effect()
  undoDeleteDraftMailEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.UNDO_DELETE_MAIL),
    map((action: UndoDeleteMail) => action.payload),
    switchMap(payload => {
      return this.mailService.moveMail(payload.ids, payload.sourceFolder, payload.sourceFolder).pipe(
        switchMap(() => of(new UndoDeleteMailSuccess(payload))),
        catchError(() => of(new SnackErrorPush({ message: `Failed to move mail to ${payload.folder}.` }))),
      );
    }),
  );

  @Effect()
  emptyTrashEffect: Observable<any> = this.actions.pipe(
    ofType(MailActionTypes.EMPTY_FOLDER),
    map((action: EmptyFolder) => action.payload),
    switchMap(payload => {
      return this.mailService.emptyFolder(payload).pipe(
        switchMap(() =>
          of(new EmptyFolderSuccess(payload), new SnackErrorPush({ message: `Mails deleted permanently.` })),
        ),
        catchError(error =>
          of(
            new SnackErrorPush({ message: `Failed to delete mails, please try again.` }),
            new EmptyFolderFailure(error.error),
          ),
        ),
      );
    }),
  );
}
