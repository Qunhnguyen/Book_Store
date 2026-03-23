from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0002_book_ai_image_url_book_image_generated_at_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='BookCategoryLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category_id', models.IntegerField()),
                ('book', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='category_links', to='app.book')),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.AddConstraint(
            model_name='bookcategorylink',
            constraint=models.UniqueConstraint(fields=('book', 'category_id'), name='unique_book_category_link'),
        ),
    ]