import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { DatabaseModule } from './database.module';
import { MailModule } from './mail.module';
import { WorkspaceFinanceService } from './workspace-finance.service';
import { WorkspaceOperationsService } from './workspace-operations.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [DatabaseModule, AuthModule, MailModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceOperationsService, WorkspaceFinanceService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
