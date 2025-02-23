// migrations.ts
import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'users',
          columns: [
            { name: 'createdAt', type: 'number' },
            { name: 'updatedAt', type: 'number' },
          ],
        }),
        addColumns({
          table: 'configs',
          columns: [
            { name: 'createdAt', type: 'number' },
            { name: 'updatedAt', type: 'number' },
          ],
        }),
      ],
    },
  ],
});

export default migrations;
