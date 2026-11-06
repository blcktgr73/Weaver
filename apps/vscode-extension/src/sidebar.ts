import * as vscode from 'vscode';
import { message } from './locale';

interface Action {
  label: string;
  command: string;
  icon: string;
}

/** The actions of Weaver, so that none of them needs the command palette. */
function actions(): Action[] {
  return [
    { label: message('ui.sidebar.open-overview'), command: 'weaver.openOverview', icon: 'project' },
    { label: message('ui.sidebar.choose-repositories'), command: 'weaver.chooseRepositories', icon: 'checklist' },
    { label: message('ui.sidebar.edit-roster'), command: 'weaver.editContributors', icon: 'organization' },
    { label: message('ui.sidebar.open-config'), command: 'weaver.openConfigFile', icon: 'settings-gear' },
    { label: message('ui.sidebar.set-up'), command: 'weaver.setUp', icon: 'wand' },
    { label: message('ui.sidebar.set-root'), command: 'weaver.setFabricRoot', icon: 'folder' },
    { label: message('ui.sidebar.clone'), command: 'weaver.cloneRegistered', icon: 'repo-clone' },
  ];
}

/** A flat list in the Weaver view of the Activity Bar; a click runs the command. */
export class SidebarProvider implements vscode.TreeDataProvider<Action> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  /** The language setting may change, and with it the labels. */
  refresh(): void {
    this.changed.fire();
  }

  getTreeItem(action: Action): vscode.TreeItem {
    const item = new vscode.TreeItem(action.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon(action.icon);
    item.command = { command: action.command, title: action.label };
    return item;
  }

  getChildren(parent?: Action): Action[] {
    return parent ? [] : actions();
  }
}
